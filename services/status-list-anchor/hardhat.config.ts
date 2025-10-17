import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } },
    },
    networks: {
        hardhat: {},
        local: {
            url: process.env.RPC_URL || "http://127.0.0.1:8545",
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
        },
        sepolia: {
            url: process.env.SEPOLIA_URL || "",
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
        },
    },
    etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || "" },
};
export default config;