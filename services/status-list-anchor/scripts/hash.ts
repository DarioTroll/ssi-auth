/**
* Calcola l'hash BLAKE2b-256 di un file locale o di una URL.
* Uso:
* npx ts-node scripts/hash.ts <path|url>
*/
import { readFile } from "fs/promises";
import { blake2b } from "blakejs";


async function readAsBuffer(input: string): Promise<Uint8Array> {
    const isUrl = /^https?:\/\//i.test(input) || /^ipfs:\/\//i.test(input);
    if (isUrl) {
        const res = await fetch(input.replace(/^ipfs:\/\//, process.env.IPFS_GATEWAY ?? "https://ipfs.io/ipfs/"));
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            const buf = new Uint8Array(await res.arrayBuffer());
        return buf;
    }
    const buf = await readFile(input);
    return new Uint8Array(buf);
}


async function main() {
    const target = process.argv[2];
    if (!target) throw new Error("Missing <path|url>");
    const data = await readAsBuffer(target);
    const digest = blake2b(data, undefined, 32); // 32 bytes = 256 bit
    const hex = "0x" + Buffer.from(digest).toString("hex");
    console.log(hex);
}


main().catch((e) => {
    console.error(e);
    process.exit(1);
});