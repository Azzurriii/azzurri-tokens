import { expect } from "chai";
import { ethers } from "hardhat";
import type { INO, NFT } from "../typechain-types";

describe("INO", function () {
  let ino: INO;
  let nft: NFT;
  let owner: any;
  let user: any;
  let treasury: any;

  const PRICE_BNB = ethers.parseEther("0.1");

  beforeEach(async function () {
    [owner, user, treasury] = await ethers.getSigners();

    // Deploy NFT
    const NFT = await ethers.getContractFactory("NFT");
    nft = await NFT.deploy(
      "Azzurri's Banana Cat",
      "ABC",
      5,
      "ipfs://QmczsfjrLS4EdhyaEs5QSgACf4Hy3DutNj9fpJzHQuZnrX/"
    );
    await nft.waitForDeployment();

    // Deploy INO
    const INO = await ethers.getContractFactory("INO");
    ino = await INO.deploy(await nft.getAddress(), treasury.address, PRICE_BNB);
    await ino.waitForDeployment();

    // Set INO as minter
    await nft.setMinter(await ino.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set the right NFT address", async function () {
      expect(await ino.nft()).to.equal(await nft.getAddress());
    });

    it("Should set the right treasury address", async function () {
      expect(await ino.treasury()).to.equal(treasury.address);
    });

    it("Should set the right BNB price", async function () {
      expect(await ino.priceBNB()).to.equal(PRICE_BNB);
    });
  });

  describe("Buying with BNB", function () {
    beforeEach(async function () {
      // Set level distribution
      await ino.setLevel({
        maxLevel1: 50, // Common
        maxLevel2: 75, // Uncommon
        maxLevel3: 90, // Rare
        maxLevel4: 98, // Epic
        maxLevel5: 100, // Legendary
      });
    });

    it("Should mint NFT when buying with correct BNB amount", async function () {
      const tx = await ino.connect(user).buyWithBNB(1, { value: PRICE_BNB });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed");

      const block = await ethers.provider.getBlock(receipt.blockNumber);
      if (!block) throw new Error("Block not found");

      await expect(tx)
        .to.emit(ino, "Buy")
        .withArgs(PRICE_BNB, "bnb", block.timestamp);

      expect(await nft.ownerOf(1)).to.equal(user.address);
    });

    it("Should not allow buying with incorrect BNB amount", async function () {
      const amount = 1;
      const value = PRICE_BNB * BigInt(amount) - BigInt(1);

      await expect(
        ino.connect(user).buyWithBNB(amount, { value })
      ).to.be.revertedWith("Amount Wrong");
    });

    it("Should mint multiple NFTs when buying multiple", async function () {
      const amount = 3;
      const value = PRICE_BNB * BigInt(amount);

      await ino.connect(user).buyWithBNB(amount, { value });

      expect(await nft.ownerOf(1)).to.equal(user.address);
      expect(await nft.ownerOf(2)).to.equal(user.address);
      expect(await nft.ownerOf(3)).to.equal(user.address);
    });
  });

  describe("Level Distribution", function () {
    it("Should respect level distribution when minting", async function () {
      // Set level distribution
      await ino.setLevel({
        maxLevel1: 50, // Common
        maxLevel2: 75, // Uncommon
        maxLevel3: 90, // Rare
        maxLevel4: 98, // Epic
        maxLevel5: 100, // Legendary
      });

      // Buy 100 NFTs
      const amount = 100;
      const value = PRICE_BNB * BigInt(amount);
      await ino.connect(user).buyWithBNB(amount, { value });

      // Count level distribution
      const levelCounts = [0, 0, 0, 0, 0];
      for (let i = 1; i <= amount; i++) {
        const level = await nft.level(i);
        levelCounts[Number(level) - 1]++;
      }

      // Check distribution
      expect(levelCounts[0]).to.be.closeTo(50, 10); // Common
      expect(levelCounts[1]).to.be.closeTo(25, 10); // Uncommon
      expect(levelCounts[2]).to.be.closeTo(15, 10); // Rare
      expect(levelCounts[3]).to.be.closeTo(8, 5); // Epic
      expect(levelCounts[4]).to.be.closeTo(2, 5); // Legendary
    });
  });
});
