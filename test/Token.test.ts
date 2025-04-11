import { expect } from "chai";
import { ethers } from "hardhat";
import type { Token } from "../typechain-types";

describe("Token", function () {
  let token: Token;
  let owner: any;
  let user: any;
  let treasury: any;
  let router: any;
  let mockRouter: any;
  let mockFactory: any;

  const NAME = "Azzurri";
  const SYMBOL = "AZR";
  const BUY_FEE = 5; // 5%
  const SELL_FEE = 5; // 5%
  const MAX_SUPPLY = ethers.parseEther("24000000");
  const INITIAL_SUPPLY = ethers.parseEther("10000000");
  const FEE_END_TIME = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days

  // This runs once before all tests in this block to set up a completely isolated network
  before(async function () {
    // Reset the Hardhat network to have a clean slate
    await ethers.provider.send("hardhat_reset", []);
  });

  // This runs after all tests to leave the network in good state for other tests
  after(async function () {
    // Reset again when done
    await ethers.provider.send("hardhat_reset", []);
  });

  beforeEach(async function () {
    [owner, user, treasury] = await ethers.getSigners();

    // Deploy MockFactory
    const MockFactory = await ethers.getContractFactory("MockFactory");
    mockFactory = await MockFactory.deploy();
    await mockFactory.waitForDeployment();
    const mockFactoryAddress = await mockFactory.getAddress();

    // Deploy MockRouter
    const MockRouter = await ethers.getContractFactory("MockRouter");
    mockRouter = await MockRouter.deploy();
    await mockRouter.waitForDeployment();

    // Deploy Token
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy(
      NAME,
      SYMBOL,
      BUY_FEE,
      SELL_FEE,
      MAX_SUPPLY,
      INITIAL_SUPPLY,
      FEE_END_TIME,
      mockFactoryAddress
    );
    await token.waitForDeployment();

    // Set mockRouter as a pair
    await token.setPair(await mockRouter.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set the right name", async function () {
      expect(await token.name()).to.equal(NAME);
    });

    it("Should set the right symbol", async function () {
      expect(await token.symbol()).to.equal(SYMBOL);
    });

    it("Should set the right initial supply", async function () {
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("Should set the right max supply", async function () {
      expect(await token.maxSupply()).to.equal(MAX_SUPPLY);
    });

    it("Should set the right fees", async function () {
      expect(await token.buyFee()).to.equal(BUY_FEE);
      expect(await token.sellFee()).to.equal(SELL_FEE);
    });

    it("Should set the right fee end time", async function () {
      expect(await token.feeEndTime()).to.equal(FEE_END_TIME);
    });

    it("Should assign the initial supply to owner", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });
  });

  describe("Fees", function () {
    beforeEach(async function () {
      // Reset state for all fee tests

      // Clear any exclusions from fees that might have been set by other tests
      await token.excludeFromFee(owner.address, false);
      await token.excludeFromFee(user.address, false);
      await token.excludeFromFee(await mockRouter.getAddress(), false);

      // Make sure the pair is properly set
      await token.setPair(await mockRouter.getAddress(), true);

      // Reset any time manipulations
      const currentBlock = await ethers.provider.getBlock("latest");
      if (currentBlock && currentBlock.timestamp > FEE_END_TIME) {
        // If we're past the fee end time due to other tests, we need to
        // deploy a fresh token contract with a new fee end time
        const Token = await ethers.getContractFactory("Token");

        // Deploy a new MockFactory to be safe
        const MockFactory = await ethers.getContractFactory("MockFactory");
        const newMockFactory = await MockFactory.deploy();
        await newMockFactory.waitForDeployment();
        const newFactoryAddress = await newMockFactory.getAddress();

        // Deploy a new token with fresh end time
        token = await Token.deploy(
          NAME,
          SYMBOL,
          BUY_FEE,
          SELL_FEE,
          MAX_SUPPLY,
          INITIAL_SUPPLY,
          Math.floor(Date.now() / 1000) + 86400 * 30, // Fresh 30 days
          newFactoryAddress
        );
        await token.waitForDeployment();
        await token.setPair(await mockRouter.getAddress(), true);
      }

      // Transfer some tokens to user and router for tests
      await token.transfer(user.address, ethers.parseEther("1000"));
    });

    it("Should charge buy fee when buying from pair", async function () {
      // Reset balances
      await token.transfer(owner.address, await token.balanceOf(user.address));

      // Explicitly verify and set up the test state
      await token.setPair(await mockRouter.getAddress(), true);
      await token.excludeFromFee(owner.address, true);
      await token.excludeFromFee(await mockRouter.getAddress(), false);
      await token.excludeFromFee(user.address, false);

      // Debug logs
      console.log(
        "Is mockRouter a pair?",
        await token.pair(await mockRouter.getAddress())
      );

      // Transfer tokens to mock router for the test
      const amount = ethers.parseEther("100");
      await token.transfer(await mockRouter.getAddress(), amount * BigInt(2));

      // Record balances before test
      const initialUserBalance = await token.balanceOf(user.address);
      const initialContractBalance = await token.balanceOf(
        await token.getAddress()
      );

      // Fund mockRouterSigner with ETH for gas
      await owner.sendTransaction({
        to: await mockRouter.getAddress(),
        value: ethers.parseEther("1"), // Send 1 ETH for gas
      });

      // Have mockRouter address sign as a signer
      await ethers.provider.send("hardhat_impersonateAccount", [
        await mockRouter.getAddress(),
      ]);
      const mockRouterSigner = await ethers.getSigner(
        await mockRouter.getAddress()
      );

      // Send tokens from pair (mockRouter) to user - this should trigger buy fee
      await token.connect(mockRouterSigner).transfer(user.address, amount);

      // Calculate expected fee
      const expectedFee = (amount * BigInt(BUY_FEE)) / BigInt(100);

      // Debug logs after transfer
      console.log("User balance after:", await token.balanceOf(user.address));
      console.log(
        "Expected user balance:",
        initialUserBalance + amount - expectedFee
      );
      console.log("Initial contract balance:", initialContractBalance);
      console.log(
        "Contract balance after:",
        await token.balanceOf(await token.getAddress())
      );
      console.log(
        "Expected contract balance:",
        initialContractBalance + expectedFee
      );
      console.log("Router address:", await mockRouter.getAddress());
      console.log(
        "Is router still a pair after transfer?",
        await token.pair(await mockRouter.getAddress())
      );

      // Check user received correct amount
      expect(
        (await token.balanceOf(user.address)) - initialUserBalance
      ).to.equal(amount - expectedFee);

      // Check contract collected fee
      expect(
        (await token.balanceOf(await token.getAddress())) -
          initialContractBalance
      ).to.equal(expectedFee);

      // Stop impersonating
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [
        await mockRouter.getAddress(),
      ]);
    });

    it("Should charge sell fee when selling to pair", async function () {
      // Explicitly verify test setup
      await token.setPair(await mockRouter.getAddress(), true);
      await token.excludeFromFee(owner.address, false);
      await token.excludeFromFee(user.address, false);
      await token.excludeFromFee(await mockRouter.getAddress(), false);

      // Debug logs
      console.log(
        "Is mockRouter a pair?",
        await token.pair(await mockRouter.getAddress())
      );
      console.log("Buy fee:", await token.buyFee());
      console.log("Sell fee:", await token.sellFee());
      console.log("Current time:", Math.floor(Date.now() / 1000));
      console.log("Fee end time:", await token.feeEndTime());
      console.log("User balance before:", await token.balanceOf(user.address));

      // Record initial balances
      const initialContractBalance = await token.balanceOf(
        await token.getAddress()
      );
      const initialRouterBalance = await token.balanceOf(
        await mockRouter.getAddress()
      );
      const initialUserBalance = await token.balanceOf(user.address);

      // User sells tokens to pair (mockRouter)
      const amount = ethers.parseEther("100");
      await token.connect(user).transfer(await mockRouter.getAddress(), amount);

      // Calculate expected fee
      const expectedFee = (amount * BigInt(SELL_FEE)) / BigInt(100);

      // Debug logs after transfer
      console.log("User balance after:", await token.balanceOf(user.address));
      console.log("Expected user balance:", initialUserBalance - amount);
      console.log(
        "Router balance after:",
        await token.balanceOf(await mockRouter.getAddress())
      );
      console.log(
        "Expected router balance:",
        initialRouterBalance + amount - expectedFee
      );
      console.log(
        "Contract balance after:",
        await token.balanceOf(await token.getAddress())
      );
      console.log(
        "Expected contract balance:",
        initialContractBalance + expectedFee
      );

      // Check user sent correct amount
      expect(await token.balanceOf(user.address)).to.equal(
        initialUserBalance - amount
      );

      // Check router received correct amount
      expect(
        (await token.balanceOf(await mockRouter.getAddress())) -
          initialRouterBalance
      ).to.equal(amount - expectedFee);

      // Check contract received fee
      expect(
        (await token.balanceOf(await token.getAddress())) -
          initialContractBalance
      ).to.equal(expectedFee);
    });

    it("Should not charge fees after fee end time", async function () {
      // Move time forward past fee end time
      await ethers.provider.send("evm_increaseTime", [86400 * 31]);
      await ethers.provider.send("evm_mine", []);

      const amount = ethers.parseEther("100");
      await token.connect(user).transfer(await mockRouter.getAddress(), amount);

      expect(await token.balanceOf(user.address)).to.equal(
        ethers.parseEther("1000") - amount
      );
      expect(await token.balanceOf(token.getAddress())).to.equal(0);
    });

    it("Should not charge fees for excluded addresses", async function () {
      await token.excludeFromFee(user.address, true);

      const amount = ethers.parseEther("100");
      await token.connect(user).transfer(await mockRouter.getAddress(), amount);

      expect(await token.balanceOf(user.address)).to.equal(
        ethers.parseEther("1000") - amount
      );
      expect(await token.balanceOf(token.getAddress())).to.equal(0);
    });

    it("Should allow owner to withdraw fees", async function () {
      // Generate fees manually by transferring to contract
      const feeAmount = ethers.parseEther("5");
      await token.transfer(await token.getAddress(), feeAmount);

      // Verify fees were collected
      const contractBalanceBefore = await token.balanceOf(
        await token.getAddress()
      );
      expect(contractBalanceBefore).to.be.at.least(feeAmount);

      // Record owner balance before withdrawal
      const ownerBalanceBefore = await token.balanceOf(owner.address);

      // Withdraw fees
      await token.withdrawFees();

      // Fees should be transferred to owner
      expect(await token.balanceOf(await token.getAddress())).to.equal(0); // Should be 0 after withdrawal
      expect(await token.balanceOf(owner.address)).to.equal(
        ownerBalanceBefore + contractBalanceBefore
      );
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      await token.setMiner(user.address, true);
      const amount = ethers.parseEther("1000");

      await token.connect(user).mint(treasury.address, amount);
      expect(await token.balanceOf(treasury.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY + amount);
    });

    it("Should not allow non-minter to mint tokens", async function () {
      const amount = ethers.parseEther("1000");
      await expect(
        token.connect(user).mint(treasury.address, amount)
      ).to.be.revertedWith("Only Minter");
    });

    it("Should not allow minting above max supply", async function () {
      await token.setMiner(user.address, true);
      const amount = MAX_SUPPLY - INITIAL_SUPPLY + BigInt(1);

      await expect(
        token.connect(user).mint(treasury.address, amount)
      ).to.be.revertedWith("Exceeds max supply");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set fees", async function () {
      const newBuyFee = 10;
      const newSellFee = 10;

      await token.setBuySellFee(newBuyFee, newSellFee);
      expect(await token.buyFee()).to.equal(newBuyFee);
      expect(await token.sellFee()).to.equal(newSellFee);
    });

    it("Should not allow setting fees above 20%", async function () {
      await expect(token.setBuySellFee(21, 21)).to.be.revertedWith(
        "Max fee is 20%"
      );
    });

    it("Should not allow non-owner to withdraw fees", async function () {
      await expect(token.connect(user).withdrawFees())
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
    });
  });
});
