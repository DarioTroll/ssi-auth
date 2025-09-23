// SPDX-License-Identifier: MIT                  
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
 * @title \Manager
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