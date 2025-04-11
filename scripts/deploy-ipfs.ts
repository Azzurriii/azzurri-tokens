import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

async function uploadToPinata(
  filePath: string,
  pinName: string
): Promise<string> {
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error(
      "Please set PINATA_API_KEY and PINATA_SECRET_KEY in .env file"
    );
  }

  const formData = new FormData();
  formData.append("file", fs.createReadStream(filePath));
  formData.append(
    "pinataMetadata",
    JSON.stringify({
      name: pinName,
    })
  );

  try {
    const response = await axios.post<PinataResponse>(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${formData.getBoundary()}`,
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );

    return response.data.IpfsHash;
  } catch (error) {
    console.error("Error uploading to Pinata:", error);
    throw error;
  }
}

async function main() {
  const assetsDir = path.join(__dirname, "../assets");
  const imagesDir = path.join(assetsDir, "images");
  const metadataDir = path.join(assetsDir, "metadata");

  // 1. Upload images
  console.log("Uploading images...");
  const imageCIDs: Record<number, string> = {};

  for (let level = 1; level <= 5; level++) {
    const imagePath = path.join(imagesDir, `${level}.png`);
    const cid = await uploadToPinata(
      imagePath,
      `Azzurri-NFT-Level-${level}-Image`
    );
    imageCIDs[level] = cid;
    console.log(`Level ${level} image uploaded: ipfs://${cid}`);
  }

  // 2. Update and upload metadata
  console.log("\nUploading metadata...");
  const metadataCIDs: Record<number, string> = {};
  const tokenIdToMetadataURL: Record<string, string> = {};

  for (let level = 1; level <= 5; level++) {
    const metadataPath = path.join(metadataDir, `${level}.json`);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    // Update image URL in metadata
    metadata.image = `ipfs://${imageCIDs[level]}`;

    // Save updated metadata
    const updatedMetadataPath = path.join(metadataDir, `updated_${level}.json`);
    fs.writeFileSync(updatedMetadataPath, JSON.stringify(metadata, null, 2));

    // Upload metadata
    const cid = await uploadToPinata(
      updatedMetadataPath,
      `Azzurri-NFT-Level-${level}-Metadata`
    );
    metadataCIDs[level] = cid;

    // Store the full URI for this level
    tokenIdToMetadataURL[level] = `ipfs://${cid}`;

    console.log(
      `Level ${level} metadata uploaded: ${tokenIdToMetadataURL[level]}`
    );

    // Clean up
    fs.unlinkSync(updatedMetadataPath);
  }

  // Save deployment info
  const deploymentInfo = {
    metadataURIs: tokenIdToMetadataURL,
    imageCIDs,
    metadataCIDs,
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployments-ipfs.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment complete!");
  console.log("Metadata URLs saved to deployments-ipfs.json");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
