import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying TokenStaking contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  let tokenAddress = "";
  let treasuryAddress = "";
  try {
    const deploymentPath = path.join(
      __dirname,
      "../deployments-bsc-testnet.json"
    );
    if (fs.existsSync(deploymentPath)) {
      const deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      tokenAddress = deployments.tokenAddress;
      treasuryAddress = deployments.treasuryAddress || deployer.address;
    }
  } catch (error) {
    console.log("No existing deployment file found or error reading it");
  }

  if (!tokenAddress) {
    console.log(
      "Please provide the Token contract address in the .env file or as an argument"
    );
    process.exit(1);
  }

  if (!treasuryAddress) {
    treasuryAddress = deployer.address;
  }

  // Set reward rate (tokens per second per staked token)
  // Default: 0.0000001 tokens per second per staked token (approx. 3.15% APY)
  const rewardRate = ethers.parseEther("0.0000001");

  const TokenStaking = await ethers.getContractFactory("TokenStaking");
  const staking = await TokenStaking.deploy(
    tokenAddress, // Using the same token for staking and rewards
    tokenAddress, // Using the same token for staking and rewards
    rewardRate,
    treasuryAddress
  );

  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();

  console.log("TokenStaking contract deployed to:", stakingAddress);

  let deployments: any = {};
  const deploymentPath = path.join(
    __dirname,
    "../deployments-bsc-testnet.json"
  );

  if (fs.existsSync(deploymentPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }

  deployments.tokenStakingAddress = stakingAddress;

  fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));

  console.log("\nTo verify on BSCScan:");
  console.log(
    `npx hardhat verify --network bscTestnet ${stakingAddress} ${tokenAddress} ${tokenAddress} ${rewardRate} ${treasuryAddress}`
  );

  return { stakingAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
