// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";


/// @title StatusListAnchor
/// @notice Mantiene l'ancoraggio on-chain di documenti StatusList2021 pubblicati off-chain.
/// Per ciascun listId si conserva: URI pubblica, hash del documento e versione.
contract StatusListAnchor is AccessControl {
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");
    struct Anchor {
        string uri; // es: https://.../statuslist.json oppure ipfs://...
        bytes32 docHash; // es: BLAKE2b-256 del documento intero
        uint256 version; // versione monotona (0,1,2,...)
        uint64 updatedAt; // timestamp blocco (cast a uint64)
        address updater; // chi ha eseguito l'ancoraggio
    }
    mapping(bytes32 => Anchor) private _anchors; // listId => Anchor
    event StatusListAnchored(bytes32 indexed listId, string uri, bytes32 docHash, uint256 version, address indexed updater);
    
    constructor(address admin) {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ANCHOR_ROLE, admin);
    }


    /// @notice Imposta/aggiorna l'ancora per una lista.
    /// @dev Richiede ANCHOR_ROLE. Versione deve essere >= versione precedente + 1 (monotona).
    function anchor(bytes32 listId, string calldata uri, bytes32 docHash, uint256 version) external onlyRole(ANCHOR_ROLE) {
        Anchor storage a = _anchors[listId];
        require(version >= a.version + 1, "version must increase");
        a.uri = uri;
        a.docHash = docHash;
        a.version = version;
        a.updatedAt = uint64(block.timestamp);
        a.updater = msg.sender;
        emit StatusListAnchored(listId, uri, docHash, version, msg.sender);
    }


    /// @notice Restituisce i dettagli dell'anchor corrente per listId.
    function get(bytes32 listId)
    external
    view
    returns (string memory uri, bytes32 docHash, uint256 version, uint256 updatedAt, address updater)
    {
        Anchor storage a = _anchors[listId];
        return (a.uri, a.docHash, a.version, a.updatedAt, a.updater);
    }
}