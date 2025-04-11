import { ethers } from "hardhat";
import { parseEther } from "ethers";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying Azzurri token...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const name = "Azzurri";
  const symbol = "AZR";
  const buyFee = 5;
  const sellFee = 5;
  const maxSupply = parseEther("24000000");
  const initialSupply = parseEther("10000000");
  const feeEndTime = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  // BSC Testnet PancakeSwap Router address
  const ROUTER_ADDRESS = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";

  // Deploy Azzurri token
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy(
    name,
    symbol,
    buyFee,
    sellFee,
    maxSupply,
    initialSupply,
    feeEndTime,
    ROUTER_ADDRESS
  );

  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("Azzurri token deployed to:", tokenAddress);

  // Save the token address to the deployments file
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments-bsc-testnet.json"
  );

  let deployData: Record<string, string> = {};
  if (fs.existsSync(deploymentPath)) {
    deployData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }

  deployData.tokenAddress = tokenAddress;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployData, null, 2));

  console.log("\nTo verify on BSCScan:");
  console.log(
    `npx hardhat verify --network bscTestnet ${tokenAddress} "${name}" "${symbol}" ${buyFee} ${sellFee} ${maxSupply} ${initialSupply} ${feeEndTime} ${ROUTER_ADDRESS}`
  );

  return { tokenAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
