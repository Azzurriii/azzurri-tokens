import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying NFTStaking contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  let nftAddress = "";
  try {
    const deploymentPath = path.join(
      __dirname,
      "../deployments-bsc-testnet.json"
    );
    if (fs.existsSync(deploymentPath)) {
      const deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
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
  const stakingAddress = await staking.getAddress();

  const deploymentData = {
    nftAddress,
    stakingAddress,
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployments-bsc-testnet.json"),
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("\nTo verify on BSCScan:");
  console.log(
    `npx hardhat verify --network bscTestnet ${stakingAddress} ${nftAddress}`
  );

  return { stakingAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
