# Overview

This document contains the **fully commented code line by line** for the Issuer → Holder → Verifier flow, plus an **operational cheatsheet** (commands and flow) and an explanation of **what happens in the EVM and on-chain** at each step.

Structure:

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

## contracts/IssuerManager.sol (includes Ownable)

```solidity
// SPDX-License-Identifier: MIT                     // File license: allows reuse with minimal restrictions
pragma solidity ^0.8.28;                            // Compiler version: enables arithmetic checks and features of 0.8.x

/**
 * @title Ownable
 * @notice Provides simple ownership control for administrative functions.
 * @dev Classic pattern: stores the owner and provides an onlyOwner modifier.
 */
contract Ownable {
    address public owner;                           // Storage slot with the owner's address; auto-generated getter
    event OwnershipTransferred(                     // Event emitted on every ownership change (log in receipt, indexed for searches)
        address indexed from,
        address indexed to
    );

    constructor() {                                 // Executed once during deployment (bytecode creation + init)
        owner = msg.sender;                         // Storage write: the account performing the deploy becomes owner
        emit OwnershipTransferred(address(0), msg.sender); // Logs transfer from "null" to new owner; no further state change
    }

    modifier onlyOwner() {                          // Modifier: expands the function body at runtime with a pre-execution check
        require(msg.sender == owner, "Ownable: not owner"); // If false → REVERT: rollback state and refund leftover gas
        _;                                          // Placeholder for the caller function body
    }

    function transferOwnership(address newOwner)    // Public API to change owner
        external
        onlyOwner                                   // Only current owner can transfer
    {
        require(newOwner != address(0), "Ownable: zero addr"); // Defensive: cannot set to zero address
        owner = newOwner;                            // Updates storage: gas cost proportional (SSTORE)
        emit OwnershipTransferred(msg.sender, newOwner); // Tracks event in receipt (does not change storage)
    }
}

/**
 * @title IssuerManager
 * @notice Manages the whitelist of Issuers authorized to issue credentials.
 * @dev Inherits Ownable so that the admin can add/remove Issuers.
 */
contract IssuerManager is Ownable {
    mapping(address => bool) public isIssuer;       // On-chain map: addr → true/false; auto getter; O(1) read
    event IssuerSet(address indexed issuer, bool allowed); // Event for auditability: who is enabled/disabled

    modifier onlyIssuer(){                          // Modifier for functions reserved to issuers
        require(isIssuer[msg.sender], "Issuer: not allowed"); // If caller not whitelisted → revert
        _;
    }

    function setIssuer(address issuer, bool allowed)
        external
        onlyOwner                                   // Only the owner can manage the list
    {
        isIssuer[issuer] = allowed;                 // Writes decision to storage
        emit IssuerSet(issuer, allowed);            // Event log (immutable, indexable)
    }
}
```

---

## contracts/CredentialRegistry.sol

```solidity
// SPDX-License-Identifier: MIT                     // License
pragma solidity ^0.8.28;                            // Compiler version

import "./IssuerManager.sol";                      // Import inheritance: includes Ownable + IssuerManager

/**
 * @title CredentialRegistry
 * @notice Minimal on-chain registry of credentials issued by whitelisted Issuers.
 * @dev Inherits IssuerManager: reuses owner and isIssuer + controls.
 */
contract CredentialRegistry is IssuerManager {
    struct Credential {                             // Persistent storage structure for each credential
        uint256 id;                                 // Internal identifier (logical key)
        address issuer;                             // Who issued (auditing, revoke permissions)
        address subject;                            // Holder (subject) to whom credential refers
        bytes32 schemaId;                           // Schema ID (e.g., hash of VC type)
        uint64 issuedAt;                            // Issuance timestamp (UNIX seconds)
        uint64 expiresAt;                           // Expiration 0=none
        bool revoked;                               // Revocation flag
    }

    uint256 public nextId = 1;                      // Auto-increment counter for IDs (storage slot)
    mapping(uint256 => Credential) public credentials; // Map id → struct Credential (getter read)

    // Secondary index: subject + schema → list of IDs (efficient queries without global scan)
    mapping(address => mapping(bytes32 => uint256[])) private _bySubjectSchema;

    event CredentialIssued(                         // Event on issuance (for UIs, indexed by issuer/subject/schema)
        uint256 indexed id,
        address indexed issuer,
        address indexed subject,
        bytes32 schemaId,
        uint64 issuedAt,
        uint64 expiresAt
    );

    event CredentialRevoked(uint256 indexed id, address indexed by); // Event on revocation

    /**
     * @notice Issues a new credential for a subject.
     * @dev Only authorized Issuers. Writes storage + emits event.
     */
    function issueCredential(
        address subject,                            // Target Holder
        bytes32 schemaId,                           // Credential type (schema hash)
        uint64 expiresAt                            // Optional expiration (0 = none)
    )
        external
        onlyIssuer
        returns (uint256 id)                        // Returns new id
    {
        require(subject != address(0), "subject=0"); // Defensive validation
        id = nextId++;                              // Read, increment and write counter (two SLOAD/SSTORE)
        credentials[id] = Credential({              // Write full struct in storage
            id: id,
            issuer: msg.sender,
            subject: subject,
            schemaId: schemaId,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false
        });
        _bySubjectSchema[subject][schemaId].push(id); // Update secondary index (dynamic on-chain array)
        emit CredentialIssued(
            id,
            msg.sender,
            subject,
            schemaId,
            uint64(block.timestamp),
            expiresAt
        );
    }

    /**
     * @notice Revokes an existing credential.
     * @dev Allowed to original Issuer or owner; sets flag and logs.
     */
    function revokeCredential(uint256 id) external {
        Credential storage c = credentials[id];
        require(c.id != 0, "not found");
        require(
            msg.sender == c.issuer || msg.sender == owner,
            "not allowed"
        );
        require(!c.revoked, "already revoked");
        c.revoked = true;                           // Update flag
        emit CredentialRevoked(id, msg.sender);
    }

    /**
     * @notice Checks if at least one valid credential exists for (subject, schemaId).
     * @dev Scans array backwards (most recent first) and returns first valid one.
     */
    function hasValidCredential(address subject, bytes32 schemaId)
        external
        view
        returns (bool ok, uint256 validId)
    {
        uint256[] storage arr = _bySubjectSchema[subject][schemaId];
        for (uint256 i = arr.length; i > 0; i--) {
            Credential storage c = credentials[arr[i-1]];
            if (
                !c.revoked &&
                (c.expiresAt == 0 || c.expiresAt > block.timestamp)
            ) {
                return (true, c.id);
            }
        }
        return (false, 0);
    }

    function isValid(uint256 id) external view returns (bool) {
        Credential storage c = credentials[id];
        if (c.id == 0 || c.revoked) return false;
        if (c.expiresAt != 0 && c.expiresAt <= block.timestamp) return false;
        return true;
    }

    function listBySubjectSchema(address subject, bytes32 schemaId)
        external
        view
        returns (uint256[] memory ids)
    {
        return _bySubjectSchema[subject][schemaId];
    }
}
```

---

## contracts/VerifierAdapter.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./CredentialRegistry.sol";

/**
 * @title VerifierAdapter
 * @notice Orchestrates authentication requests between Verifier and Holder.
 * @dev Keeps minimal request state and queries registry for validity.
 */
contract VerifierAdapter {
    enum State { Open, Approved, Denied }

    struct AuthRequest {
        uint256 id;
        address verifier;
        bytes32 schemaId;
        address subject;
        uint64 deadline;
        State state;
    }

    uint256 public nextRequestId = 1;
    mapping(uint256 => AuthRequest) public requests;

    CredentialRegistry public immutable registry;

    event RequestOpened(
        uint256 indexed id,
        address indexed verifier,
        bytes32 indexed schemaId,
        address subject,
        uint64 deadline
    );

    event AuthApproved(uint256 indexed id, address indexed subject, uint256 credentialId);
    event AuthDenied(uint256 indexed id, address indexed by);

    constructor(CredentialRegistry _registry){
        registry = _registry;
    }

    function openAuthRequest(bytes32 schemaId, address expectedSubject, uint64 ttlSeconds)
        external
        returns (uint256 id)
    {
        require(ttlSeconds > 0, "ttl=0");
        id = nextRequestId++;
        requests[id] = AuthRequest({
            id: id,
            verifier: msg.sender,
            schemaId: schemaId,
            subject: expectedSubject,
            deadline: uint64(block.timestamp) + ttlSeconds,
            state: State.Open
        });
        emit RequestOpened(
            id,
            msg.sender,
            schemaId,
            expectedSubject,
            uint64(block.timestamp) + ttlSeconds
        );
    }

    function respond(uint256 requestId) external {
        AuthRequest storage r = requests[requestId];
        require(r.id != 0, "req not found");
        require(r.state == State.Open, "req closed");
        require(block.timestamp <= r.deadline, "req expired");

        if (r.subject != address(0)) {
            require(msg.sender == r.subject, "wrong subject");
        } else {
            r.subject = msg.sender;
        }

        (bool ok, uint256 credId) =
            registry.hasValidCredential(msg.sender, r.schemaId);
        require(ok, "no valid credential");

        r.state = State.Approved;
        emit AuthApproved(requestId, msg.sender, credId);
    }

    function deny(uint256 requestId) external {
        AuthRequest storage r = requests[requestId];
        require(r.id != 0, "req not found");
        require(msg.sender == r.verifier, "not verifier");
        require(r.state == State.Open, "already closed");
        r.state = State.Denied;
        emit AuthDenied(requestId, msg.sender);
    }
}
```

---

## ignition/modules/AuthDemo.ts

```ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, toBytes } from "viem";

export default buildModule("AuthDemo", (m) => {
  const deployer = m.getAccount(0);
  const issuer   = m.getAccount(1);
  const holder   = m.getAccount(2);
  const verifier = m.getAccount(3);

  const registry = m.contract("CredentialRegistry", [], { from: deployer });
  const adapter  = m.contract("VerifierAdapter", [registry], { from: deployer });

  m.call(registry, "setIssuer", [issuer, true], { from: deployer });

  const schemaId = keccak256(toBytes("EMAIL_VERIFIED_V1"));
  m.call(registry, "issueCredential", [holder, schemaId, 0], { from: issuer });

  const opened = m.call(
    adapter,
    "openAuthRequest",
    [schemaId, holder, 600],
    { from: verifier }
  );

  m.call(
    adapter,
    "respond",
    [m.readEventArgument(opened, "RequestOpened", "id")],
    { from: holder }
  );

  return { registry, adapter };
});
```

---

## package.json – scripts

```jsonc
{
  "scripts": {
    "compile": "hardhat compile",
    "test": "vitest run",
    "deploy:demo": "hardhat ignition deploy ignition/modules/AuthDemo.ts --network hardhatMainnet"
  }
}
```

---

## What happens in the EVM and on the blockchain (per function)

### 1) `setIssuer(issuer, true)`
- **Transaction** signed by the **owner** → goes to mempool, included in a block.
- The EVM executes `onlyOwner` → *require* on `msg.sender`. If it fails, REVERT (no state change, gas consumed).
- `isIssuer[issuer] = true` writes to storage (SSTORE: gas cost). `IssuerSet(issuer, true)` emitted in the receipt (indexed log).
- **On-chain**: from now on, that address is whitelisted.

### 2) `issueCredential(holder, schemaId, expiresAt)`
- **Transaction** signed by the whitelisted **issuer**.
- EVM checks `onlyIssuer` → ok. `nextId++` reads/writes storage.
- Writes the `Credential` struct into the `credentials` mapping and updates `_bySubjectSchema` index (push into dynamic array).
- `CredentialIssued` emitted with auditing data.
- **On-chain**: state persists; later anyone can **read** validity via `eth_call` (free).

### 3) `openAuthRequest(schemaId, subject, ttl)`
- **Transaction** by the **verifier**. EVM creates an `AuthRequest` struct and stores it in the `requests` mapping.
- Computes `deadline` = `block.timestamp + ttl`.
- `RequestOpened` emitted.
- **On-chain**: request remains in `Open` state until `deadline` or closure.

### 4) `respond(requestId)`
- **Transaction** by the **holder**.
- EVM loads `AuthRequest` from storage; checks `Open` and `deadline`.
- If `subject` was 0, it sets it to `msg.sender`; otherwise it requires `msg.sender == subject`.
- Executes **external call** to `registry.hasValidCredential(holder, schemaId)`:
  - If the internal call fails (no valid credential), *require* fails → REVERT of the whole `respond`.
  - If ok, `state = Approved` and `AuthApproved(id, holder, credId)` is emitted.
- **On-chain**: request is now closed as `Approved`. UIs can filter via events or read state.

### 5) `revokeCredential(id)` (issuer or owner)
- **Transaction** by original issuer or owner.
- EVM sets `revoked = true`; emits event.
- **Effect**: future `hasValidCredential` calls will no longer consider this credential valid.

**Events and logs**: `event`s do not change state, but end up in the transaction receipt and block Bloom filters → indexable by indexers/SDKs.

**Gas and storage**: every `SSTORE` costs gas; updating from 0→non-zero is more expensive than non-zero→non-zero; clearing may refund gas (depends on opcodes and active EIPs on chain).

---

## Operational cheatsheet

### Minimum requirements
- Hardhat + Ignition + Viem (as in your current setup)
- Recent Node.js, `npm`

### Folder structure (if not already created)
```bash
mkdir -p contracts ignition/modules test
```

### Add files
- `contracts/IssuerManager.sol` (code above)
- `contracts/CredentialRegistry.sol` (code above)
- `contracts/VerifierAdapter.sol` (code above)
- `ignition/modules/AuthDemo.ts` (code above)
- Update `package.json` with the **scripts** shown

### Main commands
```bash
npm run compile                      # Compile contracts
npm run deploy:demo                  # Deploy + seed demo flow via Ignition (choose network)
```
> If your network is named differently, use `--network hardhat` or `--network localhost`.

### End-to-end flow (demo)

1. **Deploy** `CredentialRegistry` and `VerifierAdapter` (Ignition does it in correct order).
2. **setIssuer**: owner enables Issuer.
3. **issueCredential**: Issuer issues `EMAIL_VERIFIED_V1` credential for Holder.
4. **openAuthRequest**: Verifier opens a request with TTL (e.g. 600s) and expected subject.
5. **respond**: Holder responds; adapter queries registry; if valid → `Approved` + event.
6. (Optional) **revokeCredential**: Issuer/owner can revoke; from then, verification will fail.

---

### Practical notes

- `view` functions like `hasValidCredential` do not consume gas if called off-chain with `eth_call`; they consume gas if invoked internally during a transaction.
- IDs increment linearly: easy to track in UI/logs.
- `schemaId` is a `bytes32`: generated with `keccak256("SCHEMA_NAME")` for consistency between TS and Solidity.

---

### Natural extensions (for later)

- **ZK Proofs**: replace direct `hasValidCredential` call with off-chain ZK proof + on-chain verification (e.g., via verifier contract) to preserve privacy on `subject`/attributes.
- **ML Anomaly Detection**: event logs + behavior features (frequency of requests, outcomes, geolocation at application level) feed an out-of-band model deciding whether to allow/deny.


---
