import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying NFT contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // NFT parameters
  const name = "Azzurri NFT";
  const symbol = "ANFT";
  const maxLevel = 5;
  const baseUri = "ipfs://QmczsfjrLS4EdhyaEs5QSgACf4Hy3DutNj9fpJzHQuZnrX/";

  // Deploy NFT contract
  const NFT = await ethers.getContractFactory("NFT");
  const nft = await NFT.deploy(name, symbol, maxLevel, baseUri);

  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();

  console.log("NFT contract deployed to:", nftAddress);

  // Save deployment addresses
  const deploymentData = {
    nftAddress,
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployments-bsc-testnet.json"),
    JSON.stringify(deploymentData, null, 2)
  );

  // Verify command reminder
  console.log("\nTo verify on BSCScan:");
  console.log(
    `npx hardhat verify --network bscTestnet ${nftAddress} "${name}" "${symbol}" ${maxLevel} "${baseUri}"`
  );

  return { nftAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
