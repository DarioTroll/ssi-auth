//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;                            // Versione compiler

import "./IssuerManager.sol";                      // Import eredità: include Ownable + IssuerManager

/**
 * @title CredentialRegistry
 * @notice Registro on-chain minimale di credenziali emesse da Issuer whitelisted.
 * @dev Eredita IssuerManager: riusa owner e isIssuer + controlli.
 */
contract CredentialRegistry is IssuerManager {
    struct Credential {                             // Struttura persistente in storage per ogni credenziale
        uint256 id;                                 // Identificatore interno (chiave logica)
        address issuer;                             // Chi ha emesso (auditing, permessi revoke)
        address subject;                            // Holder (soggetto) a cui la credenziale si riferisce
        bytes32 schemaId;                           // ID dello schema (es. hash del tipo di VC)
        uint64 issuedAt;                            // Timestamp di emissione (secondi UNIX)
        uint64 expiresAt;                           // Scadenza 0=nessuna scadenza
        bool revoked;                               // Flag di revoca
    }

    uint256 public nextId = 1;                      // Contatore auto-increment per assegnare ID (slot in storage)
    mapping(uint256 => Credential) public credentials; // Mappa id → struct Credential (lettura via getter)

    // Indice secondario: soggetto + schema → lista di ID (per query efficienti senza scansione globale)
    mapping(address => mapping(bytes32 => uint256[])) private _bySubjectSchema;

    event CredentialIssued(                         // Evento su rilascio (per UI indicizzate, indicizzazione per issuer/subject/schema)
        uint256 indexed id,
        address indexed issuer,
        address indexed subject,
        bytes32 schemaId,
        uint64 issuedAt,
        uint64 expiresAt
    );

    event CredentialRevoked(uint256 indexed id, address indexed by); // Evento su revoca

    /**
     * @notice Emette una nuova credenziale per un soggetto.
     * @dev Solo Issuer abilitati. Scrive storage + emette evento.
     */
    function issueCredential(
        address subject,                            // Holder target
        bytes32 schemaId,                           // Tipo credenziale (hash schema)
        uint64 expiresAt                            // Scadenza opzionale (0 = nessuna)
    )
        external
        onlyIssuer                                  // Gate: solo msg.sender whitelisted in IssuerManager
        returns (uint256 id)                        // Ritorna l'id appena creato
    {
        require(subject != address(0), "subject=0"); // Validazione input difensiva
        id = nextId++;                              // Legge, incrementa e scrive il contatore (due SLOAD/SSTORE)
        credentials[id] = Credential({              // Scrive la struct completa nello storage
            id: id,
            issuer: msg.sender,                     // Issuer è il chiamante
            subject: subject,                       // Soggetto titolare
            schemaId: schemaId,                     // Schema/type
            issuedAt: uint64(block.timestamp),      // Timestamp corrente dal contesto EVM
            expiresAt: expiresAt,                   // Scadenza come passato
            revoked: false                          // Appena emessa → non revocata
        });
        _bySubjectSchema[subject][schemaId].push(id); // Aggiorna indice secondario (array dinamico on-chain)
        emit CredentialIssued(                      // Log (non modifica storage) con dati essenziali
            id,
            msg.sender,
            subject,
            schemaId,
            uint64(block.timestamp),
            expiresAt
        );
    }

    /**
     * @notice Revoca una credenziale esistente.
     * @dev Consentito all'Issuer originale o all'owner (admin); setta flag e logga.
     */
    function revokeCredential(uint256 id) external {
        Credential storage c = credentials[id];     // Ottiene un riferimento alla struct in storage
        require(c.id != 0, "not found");          // Se id non esiste → revert
        require(                                    // Controllo autorizzazione: solo issuer o owner
            msg.sender == c.issuer || msg.sender == owner,
            "not allowed"
        );
        require(!c.revoked, "already revoked");   // Evita l'idempotenza costosa
        c.revoked = true;                           // Aggiorna il flag (SSTORE → costo gas)
        emit CredentialRevoked(id, msg.sender);     // Log dell'azione (auditing)
    }

    /**
     * @notice Verifica se esiste almeno una credenziale valida per (subject, schemaId).
     * @dev Scansiona l'array indicizzato a ritroso (più recente prima) e ritorna alla prima valida.
     */
    function hasValidCredential(address subject, bytes32 schemaId)
        external
        view                                         // Solo lettura: non consuma gas se chiamata via eth_call
        returns (bool ok, uint256 validId)
    {
        uint256[] storage arr = _bySubjectSchema[subject][schemaId]; // Recupera lista ID
        for (uint256 i = arr.length; i > 0; i--) {  // Itera a ritroso (ultimo emesso per primo)
            Credential storage c = credentials[arr[i-1]]; // Carica la credenziale da storage
            if (                                     // Condizione di validità: non revocata e non scaduta
                !c.revoked &&
                (c.expiresAt == 0 || c.expiresAt > block.timestamp)
            ) {
                return (true, c.id);                 // Prima valida → ritorna
            }
        }
        return (false, 0);                           // Nessuna valida trovata
    }

    /**
     * @notice Verifica puntuale di validità per id.
     */
    function isValid(uint256 id) external view returns (bool) {
        Credential storage c = credentials[id];      // Carica
        if (c.id == 0 || c.revoked) return false;   // Inesistente o revocata
        if (c.expiresAt != 0 && c.expiresAt <= block.timestamp) return false; // Scaduta
        return true;                                 // Altrimenti valida
    }

    /**
     * @notice Restituisce tutti gli ID di credenziali per (subject, schemaId).
     * @dev Utile per UI/off-chain indexing.
     */
    function listBySubjectSchema(address subject, bytes32 schemaId)
        external
        view
        returns (uint256[] memory ids)
    {
        return _bySubjectSchema[subject][schemaId];  // Copia in memoria e ritorna
    }
}