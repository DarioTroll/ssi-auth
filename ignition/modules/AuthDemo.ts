// ignition/modules/AuthDemo.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, toBytes } from "viem";

export default buildModule("AuthDemo", (m) => {
  const deployer = m.getAccount(0);
  const issuer   = m.getAccount(1);
  const holder   = m.getAccount(2);
  const verifier = m.getAccount(3);

  const registry = m.contract("CredentialRegistry", [], { from: deployer });
  const adapter  = m.contract("VerifierAdapter", [registry], { from: deployer });

  // 1) whitelist issuer  → future 'whitelist'
  const whitelist = m.call(registry, "setIssuer", [issuer, true], { from: deployer });

  const schemaId = keccak256(toBytes("EMAIL_VERIFIED_V1"));

  // 2) issue credential  → parte solo DOPO 'whitelist'
  const issued = m.call(
    registry,
    "issueCredential",
    [holder, schemaId, 0],
    { from: issuer, after: [whitelist] }      // <<<<<< forziamo l'ordine
  );

  // 3) open auth request  → facoltativo: dopo 'issued' per essere sicuri
  const opened = m.call(
    adapter,
    "openAuthRequest",
    [schemaId, holder, 600],
    { from: verifier, after: [issued] }       // <<<<<< opzionale ma consigliato
  );

  // 4) respond → dipende dall’evento di apertura (già crea dipendenza)
  m.call(
    adapter,
    "respond",
    [m.readEventArgument(opened, "RequestOpened", "id")],
    { from: holder }
  );

  return { registry, adapter };
});
