//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;                            // Versione compiler

import "./CredentialRegistry.sol";                 // Usa il registro per verificare credenziali

/**
 * @title VerifierAdapter
 * @notice Orchestratore di richieste di autenticazione tra Verifier e Holder.
 * @dev Mantiene uno stato minimo della request e interroga il registro per validità.
 */
contract VerifierAdapter {
    enum State { Open, Approved, Denied }           // Stati possibili di una richiesta

    struct AuthRequest {                            // Struttura salvata on-chain per ogni richiesta
        uint256 id;                                 // Identificatore della request
        address verifier;                           // Chi ha aperto la richiesta (service provider)
        bytes32 schemaId;                           // Quale tipo di credenziale è richiesta
        address subject;                            // Holder atteso (0 se non vincolato)
        uint64 deadline;                            // Scadenza: non accetta risposte oltre questo timestamp
        State state;                                // Stato corrente della richiesta
    }

    uint256 public nextRequestId = 1;               // Contatore incrementale per le richieste
    mapping(uint256 => AuthRequest) public requests;// Mappa id → request (getter auto per singoli campi)

    CredentialRegistry public immutable registry;   // Riferimento al registro (immutabile dopo il deploy)

    event RequestOpened(                            // Evento per tracciamento richieste
        uint256 indexed id,
        address indexed verifier,
        bytes32 indexed schemaId,
        address subject,
        uint64 deadline
    );

    event AuthApproved(uint256 indexed id, address indexed subject, uint256 credentialId); // Evento su approvazione
    event AuthDenied(uint256 indexed id, address indexed by); // Evento su diniego esplicito

    constructor(CredentialRegistry _registry){      // Costruttore: collega il registro (indirizzo deployato prima)
        registry = _registry;                       // Imposta lo storage immutabile (salvato nel bytecode / slot immutabili)
    }

    /**
     * @notice Apre una richiesta di autenticazione.
     * @param schemaId Hash dello schema richiesto.
     * @param expectedSubject Holder atteso (0 per accettare chiunque si presenti con credenziale valida).
     * @param ttlSeconds Tempo di vita della richiesta (evita replay tardivi).
     */
    function openAuthRequest(bytes32 schemaId, address expectedSubject, uint64 ttlSeconds)
        external
        returns (uint256 id)
    {
        require(ttlSeconds > 0, "ttl=0");          // Difensiva: una richiesta deve avere scadenza
        id = nextRequestId++;                       // Assegna nuovo id
        requests[id] = AuthRequest({                // Crea la struct in storage
            id: id,
            verifier: msg.sender,                   // Il chiamante è il Verifier
            schemaId: schemaId,                     // Tipo credenziale
            subject: expectedSubject,               // Potrebbe essere 0x0 → soggetto libero
            deadline: uint64(block.timestamp) + ttlSeconds, // Calcolo scadenza
            state: State.Open                       // Stato iniziale
        });
        emit RequestOpened(                         // Log per UI/indexers
            id,
            msg.sender,
            schemaId,
            expectedSubject,
            uint64(block.timestamp) + ttlSeconds
        );
    }

    /**
     * @notice Il Holder risponde alla richiesta: se ha una credenziale valida → Approved.
     * @dev Impone che la richiesta sia aperta, non scaduta, e (se fissato) che il subject corrisponda.
     */
    function respond(uint256 requestId) external {
        AuthRequest storage r = requests[requestId]; // Riferimento alla request in storage
        require(r.id != 0, "req not found");       // Se non esiste → revert
        require(r.state == State.Open, "req closed"); // Non si può rispondere a richiesta chiusa
        require(block.timestamp <= r.deadline, "req expired"); // Non oltre la scadenza

        if (r.subject != address(0)) {              // Se il Verifier ha vincolato un subject
            require(msg.sender == r.subject, "wrong subject"); // Solo quel subject può rispondere
        } else {
            r.subject = msg.sender;                 // Altrimenti si fissa il subject al primo che risponde
        }

        (bool ok, uint256 credId) =                 // Chiamata di sola lettura al registro (via STATICCALL sotto eth_call; CALL in tx)
            registry.hasValidCredential(msg.sender, r.schemaId);
        require(ok, "no valid credential");        // Se nessuna credenziale valida → revert

        r.state = State.Approved;                   // Aggiorna stato a Approved
        emit AuthApproved(requestId, msg.sender, credId); // Log con l'id della credenziale usata
    }

    /**
     * @notice Il Verifier può negare manualmente la richiesta (p.es. policy esterne).
     */
    function deny(uint256 requestId) external {
        AuthRequest storage r = requests[requestId]; // Carica
        require(r.id != 0, "req not found");       // Validità id
        require(msg.sender == r.verifier, "not verifier"); // Solo chi l'ha aperta può negare
        require(r.state == State.Open, "already closed");  // Evita doppie chiusure
        r.state = State.Denied;                     // Aggiorna stato
        emit AuthDenied(requestId, msg.sender);     // Logga l'azione
    }
}