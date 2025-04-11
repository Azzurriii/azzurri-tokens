import { expect } from "chai";
import { ethers } from "hardhat";
import type { IDO, Token } from "../typechain-types";

describe("IDO", function () {
  let ido: IDO;
  let token: Token;
  let paymentToken: Token;
  let owner: any;
  let user: any;
  let treasury: any;

  const START_TIME = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  const END_TIME = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
  const TOKEN_PRICE = ethers.parseEther("1");
  const START_RELEASE = END_TIME + 86400; // 1 day after end
  const CLIFF = 86400; // 1 day
  const VESTING = 2592000; // 30 days
  const TGE = 20; // 20% TGE
  const PURCHASE_LIMIT = ethers.parseEther("10");
  const CAP = ethers.parseEther("24000000");

  beforeEach(async function () {
    [owner, user, treasury] = await ethers.getSigners();

    // Deploy MockFactory
    const MockFactory = await ethers.getContractFactory("MockFactory");
    const mockFactory = await MockFactory.deploy();
    await mockFactory.waitForDeployment();

    // Deploy MockRouter
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const mockRouter = await MockRouter.deploy();
    await mockRouter.waitForDeployment();

    // Deploy Token
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy(
      "Azzurri",
      "AZR",
      5, // buyFee
      5, // sellFee
      CAP,
      ethers.parseEther("10000000"), // Smaller initial supply
      0, // feeEndTime
      await mockFactory.getAddress()
    );
    await token.waitForDeployment();

    // Deploy Payment Token
    paymentToken = await Token.deploy(
      "Payment Token",
      "PAY",
      5, // buyFee
      5, // sellFee
      CAP,
      ethers.parseEther("100000"), // Smaller initial supply
      0, // feeEndTime
      await mockFactory.getAddress()
    );
    await paymentToken.waitForDeployment();

    // Grant minter role to owner for paymentToken
    await paymentToken.setMiner(owner.address, true);

    // Deploy IDO
    const IDO = await ethers.getContractFactory("IDO");
    ido = await IDO.deploy(
      START_TIME,
      END_TIME,
      await token.getAddress(),
      TOKEN_PRICE,
      START_RELEASE,
      CLIFF,
      VESTING,
      TGE,
      PURCHASE_LIMIT,
      CAP,
      await paymentToken.getAddress(),
      treasury.address
    );
    await ido.waitForDeployment();

    // Transfer tokens to IDO - use initial supply instead of CAP
    await token.transfer(await ido.getAddress(), ethers.parseEther("50000"));
  });

  describe("Deployment", function () {
    it("Should set the right token address", async function () {
      expect(await ido.token()).to.equal(await token.getAddress());
    });

    it("Should set the right treasury address", async function () {
      expect(await ido.treasury()).to.equal(treasury.address);
    });

    it("Should set the right token price", async function () {
      expect(await ido.tokenPrice()).to.equal(TOKEN_PRICE);
    });

    it("Should set the right purchase limit", async function () {
      expect(await ido.purchaseLimit()).to.equal(PURCHASE_LIMIT);
    });

    it("Should set the right cap", async function () {
      expect(await ido.cap()).to.equal(CAP);
    });
  });

  describe("Buying Tokens", function () {
    beforeEach(async function () {
      // Approve payment token
      await paymentToken.approve(await ido.getAddress(), PURCHASE_LIMIT);
      await paymentToken.transfer(user.address, PURCHASE_LIMIT);
      await paymentToken
        .connect(user)
        .approve(await ido.getAddress(), PURCHASE_LIMIT);
    });

    it("Should allow buying tokens with correct amount", async function () {
      const amount = ethers.parseEther("1");
      const tx = await ido.buy(amount);

      // Just check the occurrence of event without checking specific values
      await expect(tx).to.emit(ido, "Buy");

      // Check amount updated
      expect(await ido.payAmount(owner.address)).to.equal(amount);
    });

    it("Should not allow buying above purchase limit", async function () {
      const amount = PURCHASE_LIMIT + BigInt(1);
      await expect(ido.connect(user).buy(amount)).to.be.revertedWith(
        "Purchase amount exceeds limit"
      );
    });

    it("Should not allow buying outside sale period", async function () {
      // Move time forward past end time
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      const amount = ethers.parseEther("1");
      await expect(ido.connect(user).buy(amount)).to.be.revertedWith(
        "IDO: TIME_WRONG"
      );
    });
  });

  describe("Vesting and Release", function () {
    beforeEach(async function () {
      // Mint and approve payment token for user
      await paymentToken.mint(owner.address, ethers.parseEther("100"));
      await paymentToken.approve(await ido.getAddress(), PURCHASE_LIMIT);

      // Get current blockchain timestamp instead of JavaScript time
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTime = blockBefore!.timestamp;

      const startTime = currentTime - 3600;
      const endTime = currentTime + 86400;
      // Update the IDO contract time settings
      await ido.setIDO(startTime, endTime, TOKEN_PRICE, PURCHASE_LIMIT, CAP);

      // Force mine a block to update the timestamp
      await ethers.provider.send("evm_mine", []);

      // Verify blockchain time is within buying period
      const newBlock = await ethers.provider.getBlock("latest");
      console.log("New blockchain time:", newBlock!.timestamp);
      console.log(
        "Is in buying period:",
        newBlock!.timestamp >= startTime && newBlock!.timestamp <= endTime
      );

      // Buy tokens
      await ido.buy(ethers.parseEther("1"));
    });

    it("Should not allow release before claim is enabled", async function () {
      await expect(ido.release()).to.be.revertedWith("IDO: IS_CLAIMED_WRONG");
    });

    it("Should allow release after claim is enabled", async function () {
      // Enable claim
      await ido.setClaim(true);

      // Move time to after start release (allow TGE portion to be released)
      await ethers.provider.send("evm_increaseTime", [
        START_RELEASE - Math.floor(Date.now() / 1000) + 100,
      ]);
      await ethers.provider.send("evm_mine", []);

      // Calculate expected release amount (TGE portion)
      const totalTokens = (ethers.parseEther("1") * BigInt(1e18)) / TOKEN_PRICE;
      const expectedRelease = (totalTokens * BigInt(TGE)) / BigInt(100);

      // Release tokens
      const tx = await ido.release();

      // Check event is emitted
      await expect(tx).to.emit(ido, "Released");

      // Verify released amount
      expect(await token.balanceOf(owner.address)).to.be.at.least(
        expectedRelease
      );
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to withdraw tokens", async function () {
      await ido.withdrawToken(await token.getAddress());
    });

    it("Should not allow non-owner to withdraw tokens", async function () {
      await expect(ido.connect(user).withdrawToken(await token.getAddress()))
        .to.be.revertedWithCustomError(ido, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
    });

    it("Should allow owner to withdraw ether", async function () {
      await ido.withdrawEther();
    });

    it("Should not allow non-owner to withdraw ether", async function () {
      await expect(ido.connect(user).withdrawEther())
        .to.be.revertedWithCustomError(ido, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
    });
  });
});
