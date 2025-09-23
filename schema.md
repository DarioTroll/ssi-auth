# Panoramica

Questo documento contiene **il codice completamente commentato riga per riga** per il flusso Issuer → Holder → Verifier, più un **cheatsheet operativo** (comandi e flusso) e una spiegazione di **cosa accade nella EVM e on‑chain** in ciascun passaggio.

Struttura:

```
contracts/
  IssuerManager.sol        // include anche Ownable
  CredentialRegistry.sol
  VerifierAdapter.sol
ignition/
  modules/
    AuthDemo.ts
package.json (scripts)
```

---

## contracts/IssuerManager.sol (include Ownable)

```solidity
// SPDX-License-Identifier: MIT                     // Licenza del file: permette riuso con restrizioni minime
pragma solidity ^0.8.28;                            // Versione del compilatore: abilita arithmetic checks e features di 0.8.x

/**
 * @title Ownable
 * @notice Fornisce un semplice controllo di proprietà per funzioni amministrative.
 * @dev Pattern classico: memorizza l'owner e mette a disposizione un modifier onlyOwner.
 */
contract Ownable {
    address public owner;                           // Slot di storage con l'indirizzo del proprietario; getter auto-generato
    event OwnershipTransferred(                     // Evento emesso ad ogni cambio owner (log nel receipt, indicizzato per ricerche)
        address indexed from,
        address indexed to
    );

    constructor() {                                 // Eseguito una sola volta durante il deployment (creazione del bytecode + init)
        owner = msg.sender;                         // Scrittura in storage: l'account che effettua il deploy diventa owner
        emit OwnershipTransferred(address(0), msg.sender); // Logga il trasferimento da "null" al nuovo owner; non modifica stato ulteriore
    }

    modifier onlyOwner() {                          // Modifier: espande il corpo della funzione a runtime con un check pre-esecuzione
        require(msg.sender == owner, "Ownable: not owner"); // Se false → REVERT: annulla lo stato e rimborsa gas residuo
        _;                                          // Placeholder per il corpo della funzione chiamante
    }

    function transferOwnership(address newOwner)    // API pubblica per cambiare owner
        external                                     // Visibilità: chiamabile dall'esterno via transazione o da altri contratti
        onlyOwner                                    // Solo l'attuale owner può trasferire
    {
        require(newOwner != address(0), "Ownable: zero addr"); // Difensiva: non si può impostare lo zero address
        owner = newOwner;                            // Aggiorna storage: costo gas proporzionale (SSTORE)
        emit OwnershipTransferred(msg.sender, newOwner); // Traccia l'evento nel receipt (non modifica storage)
    }
}

/**
 * @title IssuerManager
 * @notice Gestisce la whitelist degli emettitori (Issuer) autorizzati a rilasciare credenziali.
 * @dev Eredita Ownable per permettere all'admin di aggiungere/rimuovere Issuer.
 */
contract IssuerManager is Ownable {
    mapping(address => bool) public isIssuer;       // Mappa on-chain: addr → true/false; getter auto; lettura O(1)
    event IssuerSet(address indexed issuer, bool allowed); // Evento per auditability: chi viene abilitato/disabilitato

    modifier onlyIssuer(){                          // Modifier per funzioni riservate agli emettitori
        require(isIssuer[msg.sender], "Issuer: not allowed"); // Se l'addr chiamante non è whitelisted → revert
        _;
    }

    function setIssuer(address issuer, bool allowed)
        external
        onlyOwner                                   // Solo l'owner può amministrare la lista
    {
        isIssuer[issuer] = allowed;                 // Scrive nello storage la decisione
        emit IssuerSet(issuer, allowed);            // Event log (immutabile, indicizzabile)
    }
}
```

---

## contracts/CredentialRegistry.sol

```solidity
// SPDX-License-Identifier: MIT                     // Licenza
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
```

---

## contracts/VerifierAdapter.sol

```solidity
// SPDX-License-Identifier: MIT                     // Licenza
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
```

---

## ignition/modules/AuthDemo.ts

```ts
// Modulo Ignition per deployment+seed di un flusso demo end-to-end
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"; // API per definire moduli di deploy dichiarativi
import { keccak256, toBytes } from "viem";                                 // Utility hash/schema id compatibili con viem/solidity

export default buildModule("AuthDemo", (m) => {          // Nome del modulo (namespace negli artifact di Ignition)
  const deployer = m.getAccount(0);                       // Account 0 → owner/admin
  const issuer   = m.getAccount(1);                       // Account 1 → Issuer whitelisted
  const holder   = m.getAccount(2);                       // Account 2 → Holder
  const verifier = m.getAccount(3);                       // Account 3 → Verifier (service provider)

  const registry = m.contract("CredentialRegistry", [], { from: deployer }); // Deploy del registro con owner = deployer
  const adapter  = m.contract("VerifierAdapter", [registry], { from: deployer }); // Deploy adapter puntando al registro

  m.call(registry, "setIssuer", [issuer, true], { from: deployer }); // Owner abilita l'issuer (SSTORE + evento)

  const schemaId = keccak256(toBytes("EMAIL_VERIFIED_V1"));           // Calcolo schemaId off-chain compatibile (bytes32)
  m.call(registry, "issueCredential", [holder, schemaId, 0], { from: issuer }); // Issuer rilascia credenziale senza scadenza

  const opened = m.call(                                              // Verifier apre una richiesta di auth (10 min TTL)
    adapter,
    "openAuthRequest",
    [schemaId, holder, 600],
    { from: verifier }
  );

  m.call(                                                             // Holder risponde alla request appena aperta
    adapter,
    "respond",
    [m.readEventArgument(opened, "RequestOpened", "id")],            // Estrae l'id dall'evento di apertura
    { from: holder }
  );

  return { registry, adapter };                                       // Esporta riferimenti per altri moduli o per report
});
```

---

## package.json – scripts (annotati)

> **Nota**: JSON non supporta commenti; qui sotto li mostriamo a scopo didattico. Nel tuo `package.json` inserisci solo le righe senza `// ...`.

```jsonc
{
  "scripts": {
    "compile": "hardhat compile",                      // Compila i contratti e genera artifact/ABIs
    "test": "vitest run",                              // (Opzionale finché non aggiungi i test) esegue i test TypeScript
    "deploy:demo": "hardhat ignition deploy ignition/modules/AuthDemo.ts --network hardhatMainnet" // Esegue il modulo Ignition
  }
}
```

Se non usi una rete chiamata `hardhatMainnet`, sostituisci con `--network hardhat` (rete in‑process) o `--network localhost` se hai un nodo locale.

---

## Cosa accade nella EVM e sulla blockchain (per funzione)

### 1) `setIssuer(issuer, true)`
- **Transazione** firmata dall'**owner** → arriva al mempool, viene inclusa in un blocco.
- La EVM esegue `onlyOwner` → *require* su `msg.sender`. Se fallisce, REVERT (nessuno stato cambia, gas speso).
- `isIssuer[issuer] = true` scrive in storage (SSTORE: costo gas). Emesso `IssuerSet(issuer, true)` nel receipt (log indicizzato).
- **On‑chain**: da ora quell'indirizzo è whitelisted.

### 2) `issueCredential(holder, schemaId, expiresAt)`
- **Transazione** firmata dall'**issuer** whitelisted.
- EVM verifica `onlyIssuer` → ok. `nextId++` legge/scrive storage.
- Scrive la struct `Credential` nello storage mapping `credentials` e aggiorna l'indice `_bySubjectSchema` (push su array dinamico).
- Emesso `CredentialIssued` con dati di auditing.
- **On‑chain**: lo stato persiste; più tardi chiunque può **leggere** via `eth_call` (gratis) la validità.

### 3) `openAuthRequest(schemaId, subject, ttl)`
- **Transazione** dal **verifier**. EVM crea una struct `AuthRequest` e la memorizza in mapping `requests`.
- Calcola `deadline` = `block.timestamp + ttl`.
- Emesso `RequestOpened`.
- **On‑chain**: la richiesta è nello stato `Open` fino a `deadline` o chiusura.

### 4) `respond(requestId)`
- **Transazione** dal **holder**.
- EVM carica `AuthRequest` da storage; verifica `Open` e `deadline`.
- Se `subject` era 0, lo imposta a `msg.sender`; altrimenti richiede che `msg.sender == subject`.
- Esegue **chiamata esterna** a `registry.hasValidCredential(holder, schemaId)`:
  - Se la chiamata interna fallisce (nessuna credenziale valida), *require* fallisce → REVERT dell'intera `respond`.
  - Se ok, `state = Approved` e viene emesso `AuthApproved(id, holder, credId)`.
- **On‑chain**: la request è ora chiusa come `Approved`. Le UI possono filtrare via eventi o leggere lo stato.

### 5) `revokeCredential(id)` (issuer o owner)
- **Transazione** da issuer originale o owner.
- EVM imposta `revoked = true`; emette evento.
- **Effetto**: future `hasValidCredential` non considereranno più questa credenziale valida.

**Eventi e log**: gli `event` non modificano lo stato, ma finiscono nel receipt della transazione e nei Bloom filter del blocco → indicizzabili da indexer/SDK.

**Gas e storage**: ogni `SSTORE` costa; aggiornare da 0→non‑zero è più caro di non‑zero→non‑zero; azzerare può ricevere refund (dipende da opcode e EIP attive su chain).

---

## Cheatsheet operativo

### Requisiti minimi
- Hardhat + Ignition + Viem (come da tuo setup corrente)
- Node.js recente, `npm`

### Struttura cartelle (se non già creata)
```bash
mkdir -p contracts ignition/modules test
```

### Aggiungi i file
- `contracts/IssuerManager.sol` (codice sopra)
- `contracts/CredentialRegistry.sol` (codice sopra)
- `contracts/VerifierAdapter.sol` (codice sopra)
- `ignition/modules/AuthDemo.ts` (codice sopra)
- Aggiorna `package.json` con gli **scripts** mostrati

### Comandi principali
```bash
npm run compile                      # Compila i contratti
npm run deploy:demo                  # Deploy + seed flusso demo via Ignition (rete a scelta)
```
> Se la tua rete si chiama diversamente, usa `--network hardhat` o `--network localhost`.

### Flusso end‑to‑end (demo)
1) **Deploy** `CredentialRegistry` e `VerifierAdapter` (Ignition lo fa in ordine corretto).
2) **setIssuer**: l'owner abilita l'Issuer.
3) **issueCredential**: l'Issuer emette una credenziale `EMAIL_VERIFIED_V1` per l'Holder.
4) **openAuthRequest**: il Verifier apre una richiesta con TTL (es. 600s) e subject atteso.
5) **respond**: l'Holder risponde; l'adapter interroga il registro; se valida → `Approved` + evento.
6) (Opzionale) **revokeCredential**: l'Issuer/owner può revocare; da quel momento la verifica fallirà.

### Note pratiche
- Gli `view` come `hasValidCredential` non consumano gas se chiamati off‑chain con `eth_call`; consumano gas se invocati internamente durante una transazione.
- Gli ID vengono incrementati linearmente: semplici da tracciare in UI/log.
- `schemaId` è un `bytes32`: generato con `keccak256("NOME_SCHEMA")` per coerenza tra TS e Solidity.

---

## Estensioni naturali (per dopo)
- **ZK Proofs**: sostituire la chiamata diretta `hasValidCredential` con una verifica di prova ZK off‑chain + verifica on‑chain (es. tramite verifier contract) per preservare privacy su `subject`/attributi.
- **ML Anomaly Detection**: log degli eventi + features di comportamento (frequenza richieste, esiti, geolocalizzazione lato applicativo) alimentano un modello out‑of‑band che decide se aprire/negare.

---

Se vuoi, nel prossimo step aggiungiamo:
- Test unitari Solidity (per singole funzioni)
- Test di integrazione TypeScript (viem + vitest) con scenari happy path e edge (scadenze, revoche, subject mismatch).

