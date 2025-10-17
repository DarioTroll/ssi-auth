# StatusListAnchor (modulo indipendente)
Smart contract + CLI per ancorare **StatusList2021** off-chain su blockchain
EVM.
## Perché
- Fornisce un riferimento **trust-minimized**: `docHash` e `uri` firmati
dalla chain.
- Consente a verifier e dApp di validare lo **stato** (revoca/sospensione)
delle VC.
## Architettura
- **Solidity**: `StatusListAnchor.sol` con `anchor()` e `get()`; controllo
accessi `ANCHOR_ROLE`.
9
- **CLI**: `hash` (calcolo BLAKE2b-256), `anchor` (scrittura on-chain),
`verify` (coerenza on-chain vs off-chain).
## Requisiti
- Node.js 18+
- PNPM/NPM/Yarn
- RPC EVM (Hardhat, Anvil, Sepolia, ecc.)
## Setup
```bash
npm i
cp .env.example .env
pnpm build
