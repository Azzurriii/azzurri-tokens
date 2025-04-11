import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { TokenStaking } from "../typechain-types";

describe("TokenStaking", function () {
  let staking: TokenStaking;
  let stakingToken: any;
  let rewardToken: any;
  let owner: any;
  let user: any;
  let treasury: any;

  // Constants for testing
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const STAKE_AMOUNT = ethers.parseEther("1000");
  const REWARD_RATE = ethers.parseEther("0.0001"); // Tokens per second per staked token
  const STAKING_PERIOD = 30n * 24n * 60n * 60n; // 30 days in seconds
  const EARLY_WITHDRAWAL_FEE = 10n; // 10%

  beforeEach(async function () {
    [owner, user, treasury] = await ethers.getSigners();

    // Deploy mock ERC20 tokens for staking and rewards
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    stakingToken = await ERC20Mock.deploy(
      "Staking Token",
      "STK",
      INITIAL_SUPPLY
    );
    await stakingToken.waitForDeployment();

    rewardToken = await ERC20Mock.deploy("Reward Token", "RWD", INITIAL_SUPPLY);
    await rewardToken.waitForDeployment();

    // Deploy TokenStaking contract
    const TokenStaking = await ethers.getContractFactory("TokenStaking");
    staking = await TokenStaking.deploy(
      await stakingToken.getAddress(),
      await rewardToken.getAddress(),
      REWARD_RATE,
      treasury.address
    );
    await staking.waitForDeployment();

    // Transfer tokens to user for testing
    await stakingToken.transfer(user.address, STAKE_AMOUNT);

    // Fund contract with reward tokens
    await rewardToken.approve(await staking.getAddress(), INITIAL_SUPPLY);
    await staking.fundRewards(ethers.parseEther("100000"));
  });

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await staking.stakingToken()).to.equal(
        await stakingToken.getAddress()
      );
      expect(await staking.rewardToken()).to.equal(
        await rewardToken.getAddress()
      );
    });

    it("Should set the correct reward rate", async function () {
      expect(await staking.rewardRate()).to.equal(REWARD_RATE);
    });

    it("Should set the correct fee recipient", async function () {
      expect(await staking.feeRecipient()).to.equal(treasury.address);
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      await stakingToken
        .connect(user)
        .approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user).stake(STAKE_AMOUNT);

      expect(await staking.totalStaked()).to.equal(STAKE_AMOUNT);
      expect(await staking.totalUsers()).to.equal(1);

      const userInfo = await staking.userInfo(user.address);
      expect(userInfo.stakedAmount).to.equal(STAKE_AMOUNT);
    });

    it("Should not allow staking zero amount", async function () {
      await expect(staking.connect(user).stake(0)).to.be.revertedWith(
        "Cannot stake 0"
      );
    });

    it("Should not allow staking without approval", async function () {
      await expect(
        staking.connect(user).stake(STAKE_AMOUNT)
      ).to.be.revertedWithCustomError(
        stakingToken,
        "ERC20InsufficientAllowance"
      );
    });
  });

  describe("Rewards Calculation", function () {
    beforeEach(async function () {
      await stakingToken
        .connect(user)
        .approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user).stake(STAKE_AMOUNT);
    });

    it("Should calculate rewards correctly after time passes", async function () {
      // Move forward 1 day
      const ONE_DAY_IN_SECONDS = 24n * 60n * 60n;
      await time.increase(Number(ONE_DAY_IN_SECONDS));

      const expectedReward =
        (STAKE_AMOUNT * REWARD_RATE * ONE_DAY_IN_SECONDS) /
        (ethers.parseEther("1") * 1000n);
      const calculatedReward = await staking.earned(user.address);

      expect(calculatedReward).to.be.closeTo(
        expectedReward,
        ethers.parseEther("1")
      );
    });

    it("Should allow harvesting rewards", async function () {
      // Move forward 1 day
      await time.increase(24 * 60 * 60);

      const beforeBalance = await rewardToken.balanceOf(user.address);
      await staking.connect(user).harvest();
      const afterBalance = await rewardToken.balanceOf(user.address);

      // User should have received rewards
      expect(afterBalance > beforeBalance).to.be.true;
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await stakingToken
        .connect(user)
        .approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user).stake(STAKE_AMOUNT);
    });

    it("Should apply early withdrawal fee when unstaking before period ends", async function () {
      // Move forward 1 day (still within staking period)
      await time.increase(24 * 60 * 60);

      const beforeBalance = await stakingToken.balanceOf(user.address);
      await staking.connect(user).unstake(STAKE_AMOUNT);
      const afterBalance = await stakingToken.balanceOf(user.address);

      // User should receive less than staked amount due to fee
      const feeAmount = (STAKE_AMOUNT * EARLY_WITHDRAWAL_FEE) / 100n;
      const expectedAmount = STAKE_AMOUNT - feeAmount;
      expect(afterBalance - beforeBalance).to.equal(expectedAmount);

      // Treasury should have received the fee
      const treasuryBalance = await stakingToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(feeAmount);
    });

    it("Should not apply fee when unstaking after period ends", async function () {
      // Move forward past the staking period
      await time.increase(Number(STAKING_PERIOD) + 1);

      const beforeBalance = await stakingToken.balanceOf(user.address);
      await staking.connect(user).unstake(STAKE_AMOUNT);
      const afterBalance = await stakingToken.balanceOf(user.address);

      // User should receive full staked amount
      expect(afterBalance - beforeBalance).to.equal(STAKE_AMOUNT);
    });

    it("Should update totalStaked and totalUsers correctly", async function () {
      await staking.connect(user).unstake(STAKE_AMOUNT);

      expect(await staking.totalStaked()).to.equal(0);
      expect(await staking.totalUsers()).to.equal(0);
    });
  });

  describe("Exit Function", function () {
    beforeEach(async function () {
      await stakingToken
        .connect(user)
        .approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user).stake(STAKE_AMOUNT);
      await time.increase(24 * 60 * 60); // Generate some rewards
    });

    it("Should unstake and harvest in one transaction", async function () {
      const stakingTokenBefore = await stakingToken.balanceOf(user.address);
      const rewardTokenBefore = await rewardToken.balanceOf(user.address);

      await staking.connect(user).exit();

      const stakingTokenAfter = await stakingToken.balanceOf(user.address);
      const rewardTokenAfter = await rewardToken.balanceOf(user.address);

      // Should have received staked tokens (minus fee) and rewards
      expect(stakingTokenAfter > stakingTokenBefore).to.be.true;
      expect(rewardTokenAfter > rewardTokenBefore).to.be.true;

      // Contract should have no tokens for this user
      const userInfo = await staking.userInfo(user.address);
      expect(userInfo.stakedAmount).to.equal(0);
      expect(userInfo.pendingRewards).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set reward rate", async function () {
      const newRate = ethers.parseEther("0.0002");
      await staking.setRewardRate(newRate);
      expect(await staking.rewardRate()).to.equal(newRate);
    });

    it("Should allow owner to set staking period", async function () {
      const newPeriod = 60n * 24n * 60n * 60n; // 60 days
      await staking.setStakingPeriod(newPeriod);
      expect(await staking.stakingPeriod()).to.equal(newPeriod);
    });

    it("Should allow owner to set early withdrawal fee", async function () {
      const newFee = 15;
      await staking.setEarlyWithdrawalFee(newFee);
      expect(await staking.earlyWithdrawalFee()).to.equal(newFee);
    });

    it("Should not allow setting fee above 30%", async function () {
      await expect(staking.setEarlyWithdrawalFee(31)).to.be.revertedWith(
        "Fee too high"
      );
    });

    it("Should not allow non-owner to call admin functions", async function () {
      await expect(staking.connect(user).setRewardRate(1000))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
    });
  });

  describe("Recovery Functions", function () {
    it("Should allow owner to recover tokens other than staking token", async function () {
      // Deploy a dummy token for testing recovery
      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      const dummyToken = (await ERC20Mock.deploy("Dummy", "DMY", 1000)) as any;
      await dummyToken.waitForDeployment();

      // Transfer some tokens to the staking contract
      await dummyToken.transfer(await staking.getAddress(), 500);

      // Recover the tokens
      await staking.recoverERC20(await dummyToken.getAddress(), 500);

      // Check owner received the tokens
      expect(await dummyToken.balanceOf(owner.address)).to.equal(1000);
    });

    it("Should not allow recovering staking tokens", async function () {
      await expect(
        staking.recoverERC20(await stakingToken.getAddress(), 100)
      ).to.be.revertedWith("Cannot recover staking token");
    });
  });
});
