import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying NFTStaking contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  let nftAddress = "";
  let deployments: Record<string, string> = {};
  const deploymentPath = path.join(
    __dirname,
    "../deployments-bsc-testnet.json"
  );

  try {
    if (fs.existsSync(deploymentPath)) {
      deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      nftAddress = deployments.nftAddress;
    }
  } catch (error) {
    console.log("No existing deployment file found or error reading it");
  }

  if (!nftAddress) {
    console.log(
      "Please provide the NFT contract address in the .env file or as an argument"
    );
    process.exit(1);
  }

  const NFTStaking = await ethers.getContractFactory("NFTStaking");
  const staking = await NFTStaking.deploy(nftAddress);

  await staking.waitForDeployment();
  const nftStakingAddress = await staking.getAddress();

  // Update the deployments with the staking address
  deployments.nftStakingAddress = nftStakingAddress;

  fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));

  console.log("NFT Staking contract deployed to:", nftStakingAddress);
  console.log("\nTo verify on BSCScan:");
  console.log(
    `npx hardhat verify --network bscTestnet ${nftStakingAddress} ${nftAddress}`
  );

  return { nftStakingAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
