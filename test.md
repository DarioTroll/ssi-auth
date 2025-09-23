## TEST

**Unit test** per verificare il corretto funzionamento dei contratti Solidity.

### IssuerManager.t.sol

- **File:** `contracts/IssuerManager.t.sol`
- **Contratto testato:** `IssuerManager`

#### Funzioni testate

- `testInitialOwnerIsDeployer`  
  Verifica che l’owner iniziale del contratto sia il deployer.

- `testOwnerCanTransferOwnership`  
  Controlla che l’owner possa trasferire la proprietà del contratto.

- `testNonOwnerCannotTransferOwnership`  
  Verifica che un non-owner non possa trasferire la proprietà.

- `testOwnerCanAddIssuer`  
  Controlla che solo l’owner possa aggiungere un issuer.

- `testNonOwnerCannotAddIssuer`  
  Verifica che un non-owner non possa aggiungere issuer.

- `testOwnerCanRemoveIssuer`  
  Controlla che solo l’owner possa rimuovere un issuer.

- `testNonOwnerCannotRemoveIssuer`  
  Verifica che un non-owner non possa rimuovere issuer.

- `testIssuerStateChange`  
  Verifica che lo stato di un issuer cambi correttamente (aggiunta/rimozione).

- `testDoubleAddIssuer`  
  Controlla che aggiungere lo stesso issuer due volte non causi errori.

- `testDoubleRemoveIssuer`  
  Verifica che rimuovere lo stesso issuer due volte non causi errori.

- `testOnlyIssuerModifier`  
  Test dimostrativo per il modifier `onlyIssuer`. Serve a verificare che solo gli indirizzi whitelisted possano accedere a funzioni riservate agli issuer.

---

### CredentialRegistry.t.sol

- **File:** `contracts/CredentialRegistry.t.sol`
- **Contratto testato:** `CredentialRegistry`

#### Funzioni testate

- `testIssueCredential`  
  Verifica che un issuer autorizzato possa emettere una credenziale e che venga registrata correttamente.

- `testCannotIssueCredentialIfNotIssuer`  
  Verifica che un indirizzo non autorizzato non possa emettere una credenziale (revert).

- `testRevokeCredential`  
  Verifica che un issuer possa revocare una credenziale e che la validità venga aggiornata.

- `testCannotRevokeCredentialIfNotIssuerOrOwner`  
  Verifica che solo l’issuer o l’owner possano revocare una credenziale (revert).

- `testIsValidReturnsFalseForRevoked`  
  Verifica che una credenziale revocata non sia più valida.

- `testIsValidReturnsFalseForExpired`  
  Verifica che una credenziale scaduta non sia più valida.

- `testListBySubjectSchema`  
  Verifica che la funzione di lista restituisca tutti gli ID delle credenziali per un soggetto e uno schema.

---

### VerifierAdapter.t.sol

- **File:** `contracts/VerifierAdapter.t.sol`
- **Contratto testato:** `VerifierAdapter`

#### Funzioni testate

- `testOpenAuthRequest`  
  Verifica che un verifier possa aprire una richiesta di autenticazione e che i dati siano corretti.

- `testOpenAuthRequestFailsWithZeroTTL`  
  Verifica che non sia possibile aprire una richiesta con TTL zero (revert).

- `testRespondWithValidCredential`  
  Verifica che un subject con credenziale valida possa rispondere e che la richiesta venga approvata.

- `testRespondFailsIfNoCredential`  
  Verifica che la risposta fallisca se il subject non ha una credenziale valida (revert).

- `testRespondFailsIfWrongSubject`  
  Verifica che la risposta fallisca se il subject non corrisponde a quello atteso (revert).

- `testDenyRequest`  
  Verifica che il verifier possa negare manualmente una richiesta.

- `testDenyRequestFailsIfNotVerifier`  
  Verifica che solo il verifier possa negare la richiesta (revert).