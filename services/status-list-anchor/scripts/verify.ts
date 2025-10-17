/**
* Verifica coerenza tra documento off-chain e ancora on-chain.
* Uso:
* npx ts-node scripts/verify.ts --address <contract> --list-id <hex32>
*/
import { ethers } from "hardhat";
import { parseArgs } from "node:util";
import { blake2b } from "blakejs";


async function fetchAsBytes(url: string): Promise<Uint8Array> {
    const res = await fetch(url.replace(/^ipfs:\/\//, process.env.IPFS_GATEWAY ?? "https://ipfs.io/ipfs/"));
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return new Uint8Array(await res.arrayBuffer());
}


function toHex32(bytes: Uint8Array): `0x${string}` {
    const digest = blake2b(bytes, undefined, 32);
    return ("0x" + Buffer.from(digest).toString("hex")) as `0x${string}`;
}


const { values } = parseArgs({
    options: {
    address: { type: "string", short: "a" },
        "list-id": { type: "string" },
    },
});


async function main() {
    const address = values.address as string;
    const listId = values["list-id"] as string;
    if (!address || !listId) throw new Error("Missing args");


    const anchor = await ethers.getContractAt("StatusListAnchor", address);
    const result = await anchor.get(listId as `0x${string}`);
    const [uri, onChainHash, version, updatedAt, updater] = result as unknown as [
        string,
        `0x${string}`,
        bigint,
        bigint,
        string
    ];


    const bytes = await fetchAsBytes(uri);
    const localHash = toHex32(bytes);


    const ok = localHash.toLowerCase() === onChainHash.toLowerCase();
    console.log(JSON.stringify({
        ok,
        listId,
        uri,
        onChainHash,
        localHash,
        version: version.toString(),
        updatedAt: Number(updatedAt),
        updater
    }, null, 2));


    if (!ok)
        process.exitCode = 2;
}


main().catch((e) => {
    console.error(e);
    process.exit(1);
});