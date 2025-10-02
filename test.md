# TESTS

This file documents the **unit tests** and **integration tests** used to verify the correct functioning of the Solidity contracts.  
The tests are organized by contract and by scope.

---

## Unit Tests

### IssuerManager.t.sol

- **File:** `contracts/IssuerManager.t.sol`  
- **Contract under test:** `IssuerManager`

#### Functions tested

- `testInitialOwnerIsDeployer`  
  Verifies that the initial owner of the contract is the deployer.

- `testOwnerCanTransferOwnership`  
  Checks that the owner can transfer ownership of the contract.

- `testNonOwnerCannotTransferOwnership`  
  Verifies that a non-owner cannot transfer ownership.

- `testOwnerCanAddIssuer`  
  Checks that only the owner can add an issuer.

- `testNonOwnerCannotAddIssuer`  
  Verifies that a non-owner cannot add an issuer.

- `testOwnerCanRemoveIssuer`  
  Checks that only the owner can remove an issuer.

- `testNonOwnerCannotRemoveIssuer`  
  Verifies that a non-owner cannot remove an issuer.

- `testIssuerStateChange`  
  Verifies that the state of an issuer changes correctly (add/remove).

- `testDoubleAddIssuer`  
  Checks that adding the same issuer twice does not cause errors.

- `testDoubleRemoveIssuer`  
  Verifies that removing the same issuer twice does not cause errors.

- `testOnlyIssuerModifier`  
  Demonstrates the `onlyIssuer` modifier. Ensures that only whitelisted addresses can access functions reserved for issuers.

---

### CredentialRegistry.t.sol

- **File:** `contracts/CredentialRegistry.t.sol`  
- **Contract under test:** `CredentialRegistry`

#### Functions tested

- `testIssueCredential`  
  Verifies that an authorized issuer can issue a credential and that it is correctly recorded.

- `testCannotIssueCredentialIfNotIssuer`  
  Verifies that an unauthorized address cannot issue a credential (revert).

- `testRevokeCredential`  
  Verifies that an issuer can revoke a credential and that validity is updated.

- `testCannotRevokeCredentialIfNotIssuerOrOwner`  
  Verifies that only the issuer or the owner can revoke a credential (revert).

- `testIsValidReturnsFalseForRevoked`  
  Verifies that a revoked credential is no longer valid.

- `testIsValidReturnsFalseForExpired`  
  Verifies that an expired credential is no longer valid.

- `testListBySubjectSchema`  
  Verifies that the listing function returns all credential IDs for a subject and schema.

---

### VerifierAdapter.t.sol

- **File:** `contracts/VerifierAdapter.t.sol`  
- **Contract under test:** `VerifierAdapter`

#### Functions tested

- `testOpenAuthRequest`  
  Verifies that a verifier can open an authentication request and that the data is correct.

- `testOpenAuthRequestFailsWithZeroTTL`  
  Verifies that it is not possible to open a request with TTL set to zero (revert).

- `testRespondWithValidCredential`  
  Verifies that a subject with a valid credential can respond and that the request is approved.

- `testRespondFailsIfNoCredential`  
  Verifies that the response fails if the subject does not have a valid credential (revert).

- `testRespondFailsIfWrongSubject`  
  Verifies that the response fails if the subject does not match the expected one (revert).

- `testDenyRequest`  
  Verifies that the verifier can manually deny a request.

- `testDenyRequestFailsIfNotVerifier`  
  Verifies that only the verifier can deny the request (revert).

---

## Integration Tests

### Integration.ts

- **File:** `test/Integration.ts`  
- **Contracts under test:** `CredentialRegistry`, `VerifierAdapter`  

#### Scenarios tested

- **Happy path (end-to-end flow)**  
  Verifies the complete lifecycle: an owner whitelists an issuer → issuer issues a valid credential → verifier opens an authentication request → holder responds → request is approved and credential remains valid.

- **Only owner can setIssuer**  
  Ensures that attempts by non-owners to whitelist issuers are rejected.

- **Respond fails without valid credential**  
  Checks that a subject without a valid credential cannot successfully respond to an authentication request.

- **Respond fails after deadline**  
  Ensures that if the TTL of a request has expired, the subject cannot respond.

- **Revocation by issuer/owner**  
  Verifies that revoking a credential renders it invalid and prevents its use in future authentication responses.

- **Deny request (access control)**  
  Ensures that only the verifier who created a request can deny it. Once denied, the request state changes to *Denied* and further responses are rejected.

- **Respond without predefined subject**  
  Tests the case where the verifier opens a request with `0x0` as the subject. The first valid responder becomes the subject. Valid responders succeed, invalid responders fail.
