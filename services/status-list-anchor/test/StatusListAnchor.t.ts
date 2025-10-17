import { expect } from "chai";
import { ethers } from "hardhat";


function toBytes32(hex: string) {
    return ethers.hexlify(ethers.zeroPadValue(hex, 32));
}


describe("StatusListAnchor", () => {
    it("deploy + anchor + get", async () => {
        const [admin, other] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("StatusListAnchor");
        const c = await Factory.deploy(admin.address);
        await c.waitForDeployment();


        const id = toBytes32("0x01");
        const uri1 = "https://example.org/statuslist-v1.json";
        const h1 = toBytes32("0x1234");


        await expect(c.connect(other).anchor(id, uri1, h1, 0n)).to.be.rejected; // no role


        await expect(c.anchor(id, uri1, h1, 1n)).to.emit(c, "StatusListAnchored");


        const [uri, hash, version] = await c.get(id);
        expect(uri).to.eq(uri1);
        expect(hash).to.eq(h1);
        expect(version).to.eq(1n);


        await expect(c.anchor(id, uri1, h1, 1n)).to.be.revertedWith("version must increase");


        const h2 = toBytes32("0x5678");
        await c.anchor(id, uri1, h2, 2n);
        const [_, hash2, v2] = await c.get(id);
        expect(hash2).to.eq(h2);
        expect(v2).to.eq(2n);
    });
});