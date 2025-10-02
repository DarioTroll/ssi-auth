# SSI Auth Demo

> An authentication system based on **Smart Contracts** with **Hardhat** and **Ignition**.

---

A simple flow for managing credentials on the blockchain. The main actors are:

- **Deployer** → distributes the contracts.
- **Issuer** → an authorized entity that issues credentials.
- **Holder** → the user who receives the credential.
- **Verifier** → verifies authenticity via the `VerifierAdapter`.

The `AuthDemo.ts` deployment module distributes:

1. `CredentialRegistry` (credential registry).
2. `VerifierAdapter` (to verify credentials).
3. `Issuer` whitelist.
4. Issuance of a demo credential to the `Holder`.

---

## Requirements

- [Node.js](https://nodejs.org/) **>= 18**
- [npm](https://www.npmjs.com/) (included with Node.js)
- [Hardhat](https://hardhat.org/) **>= 3.x**

---

## Installation

Clone the repository and install the dependencies:

```bash
git clone [https://github.com/DarioTroll/ssi-auth.git](https://github.com/DarioTroll/ssi-auth.git)
cd ssi-auth
npm install