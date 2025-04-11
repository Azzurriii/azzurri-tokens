import { expect } from "chai";
import { ethers } from "hardhat";
import { NFT } from "../typechain-types";

describe("NFT", function () {
  let nft: NFT;
  let owner: any;
  let minter: any;
  let user: any;

  const NAME = "Azzurri's Banana Cat";
  const SYMBOL = "ABC";
  const MAX_LEVEL = 5;
  const BASE_URI = "ipfs://QmczsfjrLS4EdhyaEs5QSgACf4Hy3DutNj9fpJzHQuZnrX/";

  beforeEach(async function () {
    [owner, minter, user] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("NFT");
    nft = await NFT.deploy(NAME, SYMBOL, MAX_LEVEL, BASE_URI);
    await nft.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right name", async function () {
      expect(await nft.name()).to.equal(NAME);
    });

    it("Should set the right symbol", async function () {
      expect(await nft.symbol()).to.equal(SYMBOL);
    });

    it("Should set the right max level", async function () {
      expect(await nft.maxLevel()).to.equal(MAX_LEVEL);
    });

    it("Should set the right base URI", async function () {
      await nft.setMinter(owner.address, true);
      await nft.mint(user.address, 1);
      expect(await nft.tokenURI(1)).to.equal(`${BASE_URI}1.json`);
    });
  });

  describe("Minting", function () {
    beforeEach(async function () {
      await nft.setMinter(minter.address, true);
    });

    it("Should mint NFT with correct level", async function () {
      await nft.connect(minter).mint(user.address, 1);
      expect(await nft.level(1)).to.equal(1);
    });

    it("Should not allow minting with invalid level", async function () {
      await expect(
        nft.connect(minter).mint(user.address, 0)
      ).to.be.revertedWith("level wrong");
      await expect(
        nft.connect(minter).mint(user.address, MAX_LEVEL + 1)
      ).to.be.revertedWith("level wrong");
    });

    it("Should not allow non-minter to mint", async function () {
      await expect(nft.connect(user).mint(user.address, 1)).to.be.revertedWith(
        "Only Minter"
      );
    });
  });

  describe("Token URI", function () {
    beforeEach(async function () {
      await nft.setMinter(minter.address, true);
      await nft.connect(minter).mint(user.address, 1);
    });

    it("Should return correct token URI", async function () {
      expect(await nft.tokenURI(1)).to.equal(`${BASE_URI}1.json`);
    });

    it("Should revert for non-existent token", async function () {
      await expect(nft.tokenURI(2)).to.be.reverted;
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await nft.setMinter(minter.address, true);
      await nft.connect(minter).mint(user.address, 1);
    });

    it("Should allow owner to burn", async function () {
      await nft.connect(user).burn(1);
      await expect(nft.ownerOf(1)).to.be.reverted;
    });

    it("Should allow approved to burn", async function () {
      await nft.connect(user).approve(minter.address, 1);
      await nft.connect(minter).burn(1);
      await expect(nft.ownerOf(1)).to.be.reverted;
    });

    it("Should not allow non-owner to burn", async function () {
      await expect(nft.connect(minter).burn(1)).to.be.revertedWith(
        "Not owner nor approved"
      );
    });
  });
});
