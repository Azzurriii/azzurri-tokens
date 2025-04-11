import { expect } from "chai";
import { ethers } from "hardhat";
import type { NFTStaking, NFT } from "../typechain-types";

describe("NFTStaking", function () {
  let staking: NFTStaking;
  let nft: NFT;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy NFT
    const NFT = await ethers.getContractFactory("NFT");
    nft = await NFT.deploy("Azzurri's Banana Cat", "ABC", 5);
    await nft.waitForDeployment();

    // Deploy NFTStaking
    const NFTStaking = await ethers.getContractFactory("NFTStaking");
    staking = await NFTStaking.deploy(await nft.getAddress());
    await staking.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right NFT address", async function () {
      expect(await staking.nft()).to.equal(await nft.getAddress());
    });
  });

  describe("NFTStaking", function () {
    beforeEach(async function () {
      // Mint NFT to user
      await nft.setMinter(owner.address, true);
      await nft.connect(owner).mint(user.address, 1);
    });

    it("Should allow staking NFT", async function () {
      await nft.connect(user).approve(await staking.getAddress(), 1);
      await staking.connect(user).stake([1]);

      expect(await nft.ownerOf(1)).to.equal(await staking.getAddress());
      expect(await staking.balanceOf(user.address)).to.equal(1);
      expect(await staking.totalStaked()).to.equal(1);
      expect(await staking.totalUsers()).to.equal(1);
    });

    it("Should not allow staking empty array", async function () {
      await expect(staking.connect(user).stake([])).to.be.revertedWith(
        "LENGTH_WRONG"
      );
    });

    it("Should not allow staking non-owned NFT", async function () {
      await expect(
        staking.connect(user).stake([1])
      ).to.be.revertedWithCustomError(nft, "ERC721InsufficientApproval");
    });

    it("Should not allow staking without approval", async function () {
      await expect(
        staking.connect(owner).stake([1])
      ).to.be.revertedWithCustomError(nft, "ERC721InsufficientApproval");
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      // Mint and stake NFT
      await nft.setMinter(owner.address, true);
      await nft.connect(owner).mint(user.address, 1);
      await nft.connect(user).approve(await staking.getAddress(), 1);
      await staking.connect(user).stake([1]);
    });

    it("Should allow unstaking NFT", async function () {
      await staking.connect(user).unstake([1]);
      expect(await nft.ownerOf(1)).to.equal(user.address);
      expect(await staking.balanceOf(user.address)).to.equal(0);
      expect(await staking.totalStaked()).to.equal(0);
      expect(await staking.totalUsers()).to.equal(0);
    });

    it("Should not allow unstaking empty array", async function () {
      await expect(staking.connect(user).unstake([])).to.be.revertedWith(
        "LENGTH_WRONG"
      );
    });

    it("Should not allow unstaking non-staked NFT", async function () {
      await expect(staking.connect(user).unstake([2])).to.be.revertedWith(
        "OWNER_NFT_WRONG"
      );
    });

    it("Should not allow unstaking others' NFT", async function () {
      await nft.connect(owner).mint(owner.address, 2);
      await nft.connect(owner).approve(await staking.getAddress(), 2);
      await staking.connect(owner).stake([2]);

      await expect(staking.connect(user).unstake([2])).to.be.revertedWith(
        "OWNER_NFT_WRONG"
      );
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set NFT address", async function () {
      const newNFT = await (
        await ethers.getContractFactory("NFT")
      ).deploy("New NFT", "NEW", 5);
      await newNFT.waitForDeployment();

      await staking.setNft(await newNFT.getAddress());
      expect(await staking.nft()).to.equal(await newNFT.getAddress());
    });

    it("Should not allow non-owner to set NFT address", async function () {
      await expect(staking.connect(user).setNft(await nft.getAddress()))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
    });
  });
});
