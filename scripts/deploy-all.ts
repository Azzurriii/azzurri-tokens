import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Starting deployment to BSC Testnet...");

  try {
    // Deploy NFT contract
    console.log("\n=== Deploying NFT Contract ===");
    execSync(
      "npx hardhat run scripts/deploy/00-deploy-nft.ts --network bscTestnet",
      { stdio: "inherit" }
    );

    // Deploy Azzurri token
    console.log("\n=== Deploying Azzurri Token ===");
    execSync(
      "npx hardhat run scripts/deploy/01-deploy-token.ts --network bscTestnet",
      { stdio: "inherit" }
    );

    // Deploy Staking contract
    console.log("\n=== Deploying Staking Contract ===");
    execSync(
      "npx hardhat run scripts/deploy/02-deploy-staking.ts --network bscTestnet",
      { stdio: "inherit" }
    );

    // Deploy IDO contract
    console.log("\n=== Deploying IDO Contract ===");
    execSync(
      "npx hardhat run scripts/deploy/03-deploy-ido.ts --network bscTestnet",
      { stdio: "inherit" }
    );

    // Deploy INO contract
    console.log("\n=== Deploying INO Contract ===");
    execSync(
      "npx hardhat run scripts/deploy/04-deploy-ino.ts --network bscTestnet",
      { stdio: "inherit" }
    );

    // Print summary of all deployments
    console.log("\n=== Deployment Complete ===");
    const deploymentPath = path.join(__dirname, "deployments-bsc-testnet.json");
    if (fs.existsSync(deploymentPath)) {
      const deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      console.log("Deployed Contracts:");
      Object.entries(deployments).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });
    }
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
