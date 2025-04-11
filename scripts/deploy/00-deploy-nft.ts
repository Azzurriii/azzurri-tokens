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

  // Load metadata URIs from IPFS deployment
  const ipfsDeploymentPath = path.join(
    __dirname,
    "../../deployments-ipfs.json"
  );
  const ipfsDeployment = JSON.parse(
    fs.readFileSync(ipfsDeploymentPath, "utf8")
  );
  const metadataURIs = ipfsDeployment.metadataURIs || {};

  // Deploy NFT contract
  const NFT = await ethers.getContractFactory("NFT");
  const nft = await NFT.deploy(name, symbol, maxLevel);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();

  console.log("NFT contract deployed to:", nftAddress);

  // Prepare URIs array for all levels
  const uris = [];
  for (let level = 1; level <= maxLevel; level++) {
    if (!metadataURIs[level]) {
      throw new Error(`No metadata URI found for level ${level}`);
    }
    uris.push(metadataURIs[level]);
    console.log(`Level ${level} URI: ${metadataURIs[level]}`);
  }

  // Set all level URIs at once
  console.log("Setting all level URIs...");
  const tx = await nft.setAllLevelURIs(uris);
  await tx.wait();
  console.log("All level URIs set successfully");

  const deploymentData = {
    nftAddress,
    metadataURIs,
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployments-bsc-testnet.json"),
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("\nTo verify on BSCScan:");
  console.log(
    `npx hardhat verify --network bscTestnet ${nftAddress} "${name}" "${symbol}" ${maxLevel}`
  );

  return { nftAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
