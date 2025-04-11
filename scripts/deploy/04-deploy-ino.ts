import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying INO contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get NFT contract address from deployments file
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments-bsc-testnet.json"
  );
  let deployments: Record<string, string> = {};

  if (fs.existsSync(deploymentPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  } else {
    throw new Error(
      "Deployment file not found. Please deploy NFT contract first."
    );
  }

  const nftAddress = deployments.nftAddress;
  if (!nftAddress) {
    throw new Error("NFT contract address not found in deployments file.");
  }

  // INO parameters
  const treasury = deployer.address;
  const priceBNB = ethers.parseEther("0.001"); // Price per NFT in BNB

  // Deploy INO contract
  const INO = await ethers.getContractFactory("INO");
  const ino = await INO.deploy(nftAddress, treasury, priceBNB);

  await ino.waitForDeployment();
  const inoAddress = await ino.getAddress();

  console.log("INO contract deployed to:", inoAddress);

  // Configure NFT levels
  console.log("Setting NFT levels...");
  const level = {
    maxLevel1: 60, // 60% chance for Common
    maxLevel2: 80, // 20% chance for Uncommon
    maxLevel3: 90, // 10% chance for Rare
    maxLevel4: 97, // 7% chance for Epic
    maxLevel5: 100, // 3% chance for Legendary
  };

  await ino.setLevel(level);
  console.log("NFT levels set successfully");

  // Set INO as a minter
  console.log("Setting INO as a minter...");
  const NFT = await ethers.getContractFactory("NFT");
  const nft = NFT.attach(nftAddress) as any;
  await nft.setMinter(inoAddress, true);
  console.log("INO set as a minter successfully");

  // Save deployment address
  deployments.INO = inoAddress;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));

  // Verify command reminder
  console.log("\nTo verify on BSCScan:");
  console.log(
    `npx hardhat verify --network bscTestnet ${inoAddress} "${nftAddress}" "${treasury}" "${priceBNB}"`
  );

  return { inoAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
