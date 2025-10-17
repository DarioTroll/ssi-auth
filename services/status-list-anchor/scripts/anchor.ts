/**
* Ancoraggio su StatusListAnchor.
* Uso:
* npx ts-node scripts/anchor.ts --address <contract> --list-id <hex32> --uri <uri> --hash <0x..> --version <n>
*/
import { ethers } from "hardhat";
import { parseArgs } from "node:util";


const { values } = parseArgs({
    options: {
    address: { type: "string", short: "a" },
    "list-id": { type: "string" },
    uri: { type: "string" },
    hash: { type: "string" },
    version: { type: "string" },
    },
});


async function main() {
    const address = values.address as string;
    const listId = values["list-id"] as string;
    const uri = values.uri as string;
    const hash = values.hash as string;
    const version = BigInt(values.version as string);


    if (!address || !listId || !uri || !hash || !version)
        throw new Error("Missing required args");


    const anchor = await ethers.getContractAt("StatusListAnchor", address);
    const tx = await anchor.anchor(listId as `0x${string}`, uri, hash as `0x${string}`, version);
    const rc = await tx.wait();
    console.log("Tx:", rc?.hash);
}


main().catch((e) => {
    console.error(e);
    process.exit(1);
});