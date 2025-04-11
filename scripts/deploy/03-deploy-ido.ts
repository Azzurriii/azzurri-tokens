import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying IDO contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get Azzurri token address from deployments file
  const deployments = require("../deployments-bsc-testnet.json");
  const tokenAddress = deployments.AzzurriToken;

  // IDO parameters
  const startTime = Math.floor(Date.now() / 1000) + 3600; // Start in 1 hour
  const endTime = startTime + 7 * 24 * 3600; // 7 days duration
  const tokenPrice = ethers.parseEther("0.0001"); // Price per token in payment token
  const startRelease = endTime + 3600; // Start releasing 1 hour after IDO ends
  const cliff = 0; // No cliff
  const vesting = 30 * 24 * 3600; // 30 days vesting period
  const tge = 20; // 20% released at TGE
  const purchaseLimit = ethers.parseEther("5"); // Maximum amount per user in payment token
  const cap = ethers.parseEther("1000"); // Total sale cap in payment token
  const tokenPayment = "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7"; // BUSD on BSC Testnet
  const treasury = deployer.address; // Treasury address (could be changed later)

  // Deploy IDO contract
  const IDO = await ethers.getContractFactory("IDO");
  const ido = await IDO.deploy(
    startTime,
    endTime,
    tokenAddress,
    tokenPrice,
    startRelease,
    cliff,
    vesting,
    tge,
    purchaseLimit,
    cap,
    tokenPayment,
    treasury
  );

  await ido.waitForDeployment();
  const idoAddress = await ido.getAddress();

  console.log("IDO contract deployed to:", idoAddress);

  // Save deployment address
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments-bsc-testnet.json"
  );

  let deployData: Record<string, string> = {};
  if (fs.existsSync(deploymentPath)) {
    deployData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }

  deployData.IDO = idoAddress;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployData, null, 2));

  // Verify command reminder
  console.log("\nTo verify on BSCScan:");
  console.log(
    `npx hardhat verify --network bscTestnet ${idoAddress} ${startTime} ${endTime} "${tokenAddress}" ${tokenPrice} ${startRelease} ${cliff} ${vesting} ${tge} ${purchaseLimit} ${cap} "${tokenPayment}" "${treasury}"`
  );

  return { idoAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
