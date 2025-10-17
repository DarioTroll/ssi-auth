import { ethers } from "hardhat";


async function main() {
    const [deployer] = await ethers.getSigners();
    const admin = process.env.ANCHOR_ADMIN ?? deployer.address;

    console.log("Deploy from:", deployer.address);
    console.log("Admin:", admin);


    const Factory = await ethers.getContractFactory("StatusListAnchor");
    const contract = await Factory.deploy(admin);
    await contract.waitForDeployment();


    const addr = await contract.getAddress();
    console.log("StatusListAnchor deployed:", addr);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});