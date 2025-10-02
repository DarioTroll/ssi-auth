// Integration.ts
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import type { Hex } from "viem";
import { keccak256, stringToHex } from "viem";

function uniqueSchema(label: string) {
  return keccak256(stringToHex(`${label}:${Date.now()}:${Math.random()}`));
}

describe("Integration (CredentialRegistry + VerifierAdapter)", async () => {
  const { viem } = await network.connect();

  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const [owner, issuer, holder, verifier, stranger] = await viem.getWalletClients();

  // Contratti
  let registry: any;
  let adapter: any;

  // Dati di test
  const schemaId: Hex = keccak256(stringToHex("KYC.Basic"));
  const oneHour = 60n * 60n;

  before(async () => {
    // Deploy dei contratti
    registry = await viem.deployContract("CredentialRegistry", []);
    adapter = await viem.deployContract("VerifierAdapter", [registry.address]);
  });

  it("happy path: issuer whitelisted -> issue -> open request -> holder responds -> approved", async () => {
    // owner abilita l'issuer
    await registry.write.setIssuer([issuer.account.address, true], { account: owner.account });

    // issuer emette una credenziale valida per holder
    const now = BigInt((await publicClient.getBlock()).timestamp);
    const expires = now + 24n * oneHour;

    const txIssue = await registry.write.issueCredential(
      [holder.account.address, schemaId, Number(expires)], // expiresAt è uint64, ok il Number
      { account: issuer.account }
    );

    const rcIssue = await publicClient.waitForTransactionReceipt({ hash: txIssue });
    assert.equal(rcIssue.status, "success");

    // ricava l'ID appena emesso (ultimo per subject+schema)
    const ids: bigint[] = await registry.read.listBySubjectSchema([holder.account.address, schemaId]);
    assert.ok(ids.length > 0, "nessuna credenziale trovata dopo issue");
    const credId = ids[ids.length - 1];

    // sanity: deve essere valida
    const isValidBefore: boolean = await registry.read.isValid([credId]);
    assert.equal(isValidBefore, true);

    // verifier apre una richiesta
    const ttl = 10 * 60; // 10 minuti
    const txOpen = await adapter.write.openAuthRequest([schemaId, holder.account.address, ttl], {
      account: verifier.account,
    });
    const rcOpen = await publicClient.waitForTransactionReceipt({ hash: txOpen });
    assert.equal(rcOpen.status, "success");

    // ricava requestId dall’evento oppure usa il contatore pubblico
    // qui usiamo il contatore pubblico per semplicità: nextRequestId è incrementale
    const nextId: bigint = await adapter.read.nextRequestId();
    const reqId = nextId - 1n;

    // holder risponde -> Approved
    const txResp = await adapter.write.respond([reqId], { account: holder.account });
    const rcResp = await publicClient.waitForTransactionReceipt({ hash: txResp });
    assert.equal(rcResp.status, "success");

    // stato deve essere Approved (enum State: 0 Open, 1 Approved, 2 Denied)
    const request = await adapter.read.requests([reqId]);
    assert.equal(Number(request[5]), 1, "request non in stato Approved");

    // ancora valida
    const isValidAfter: boolean = await registry.read.isValid([credId]);
    assert.equal(isValidAfter, true);
  });

  it("solo owner può setIssuer", async () => {
    await assert.rejects(
      registry.write.setIssuer([stranger.account.address, true], { account: stranger.account }),
      /Ownable: not owner|not owner|Only/ // dipende dal messaggio preciso
    );
  });

  it("respond fallisce se il subject non ha credenziale valida", async () => {
    // Verifier apre una richiesta per lo schema, ma il subject è 'stranger' senza credenziale
    const txOpen = await adapter.write.openAuthRequest([schemaId, stranger.account.address, 300], {
      account: verifier.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: txOpen });
    const nextId: bigint = await adapter.read.nextRequestId();
    const reqId = nextId - 1n;

    await assert.rejects(
      adapter.write.respond([reqId], { account: stranger.account }),
      /no valid credential|revert/
    );
  });

  it("respond fallisce oltre la deadline", async () => {
    // nuova richiesta con TTL brevissimo
    const txOpen = await adapter.write.openAuthRequest([schemaId, holder.account.address, 1], {
      account: verifier.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: txOpen });
    const nextId: bigint = await adapter.read.nextRequestId();
    const reqId = nextId - 1n;

    // avanza il tempo oltre la deadline
    await testClient.increaseTime({ seconds: 2 });
    await testClient.mine({ blocks: 1 });

    await assert.rejects(adapter.write.respond([reqId], { account: holder.account }), /req expired|expired/);
  });

  it("revoke dall'issuer (o dall'owner) rende la credenziale non valida", async () => {
  const localSchemaId = uniqueSchema("REVOCATION");

  // whitelist issuer se non già fatto in before()
  await registry.write.setIssuer([issuer.account.address, true], { account: owner.account });

  const now = BigInt((await publicClient.getBlock()).timestamp);
  const expires = now + 6n * oneHour;

  await publicClient.waitForTransactionReceipt({
    hash: await registry.write.issueCredential(
      [holder.account.address, localSchemaId, Number(expires)],
      { account: issuer.account }
    ),
  });

  const ids: bigint[] = await registry.read.listBySubjectSchema([holder.account.address, localSchemaId]);
  const credId = ids[ids.length - 1];

  await publicClient.waitForTransactionReceipt({
    hash: await registry.write.revokeCredential([credId], { account: issuer.account }),
  });

  assert.equal(await registry.read.isValid([credId]), false);

  await publicClient.waitForTransactionReceipt({
    hash: await adapter.write.openAuthRequest([localSchemaId, holder.account.address, 600], {
      account: verifier.account,
    }),
  });
  const reqId = (await adapter.read.nextRequestId()) - 1n;

  await assert.rejects(
    adapter.write.respond([reqId], { account: holder.account }),
    /no valid credential|revert/
  );
});

  it("deny: solo il verifier che ha aperto può negare e chiude la richiesta", async () => {
    // apri una nuova richiesta
    const txOpen = await adapter.write.openAuthRequest([schemaId, holder.account.address, 600], {
      account: verifier.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: txOpen });
    const nextId: bigint = await adapter.read.nextRequestId();
    const reqId = nextId - 1n;

    // un estraneo NON può negare
    await assert.rejects(adapter.write.deny([reqId], { account: stranger.account }), /not verifier|revert/);

    // il verifier può
    const txDeny = await adapter.write.deny([reqId], { account: verifier.account });
    await publicClient.waitForTransactionReceipt({ hash: txDeny });

    const request = await adapter.read.requests([reqId]);
    assert.equal(Number(request[5]), 2, "request non in stato Denied");

    // rispondere dopo deny deve fallire
    await assert.rejects(adapter.write.respond([reqId], { account: holder.account }), /req closed|revert/);
  });

  it("respond senza subject vincolato: il primo responder diventa il subject", async () => {
    // issuer emette una credenziale valida per 'holder'
    const now = BigInt((await publicClient.getBlock()).timestamp);
    const expires = now + 12n * oneHour;
    const txIssue = await registry.write.issueCredential(
      [holder.account.address, schemaId, Number(expires)],
      { account: issuer.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: txIssue });

    // apri richiesta con subject = 0x0 (libero)
    const zero = "0x0000000000000000000000000000000000000000";
    const txOpen = await adapter.write.openAuthRequest([schemaId, zero, 600], {
      account: verifier.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: txOpen });
    const nextId: bigint = await adapter.read.nextRequestId();
    const reqId = nextId - 1n;

    // uno che NON ha credenziale non può diventare subject (stranger fallisce)
    await assert.rejects(adapter.write.respond([reqId], { account: stranger.account }), /no valid credential|revert/);

    // holder (che ha la credenziale) risponde e diventa subject -> Approved
    const txResp = await adapter.write.respond([reqId], { account: holder.account });
    await publicClient.waitForTransactionReceipt({ hash: txResp });

    const r = await adapter.read.requests([reqId]);
    assert.equal(r[3].toLowerCase(), holder.account.address.toLowerCase());
    assert.equal(Number(r[5]), 1);
  });
});
