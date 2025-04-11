// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TokenStaking is Ownable {
    using SafeERC20 for IERC20;

    address public stakingToken;
    address public rewardToken;

    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    // Accumulated rewards per token, scaled by 1e18
    uint256 public rewardPerTokenStored;
    uint256 public stakingPeriod = 30 days; // 30 days
    uint256 public earlyWithdrawalFee = 10; // 10%
    address public feeRecipient;

    struct UserInfo {
        uint256 stakedAmount;
        uint256 rewardDebt;
        uint256 pendingRewards;
        uint256 lastStakeTime;
    }

    mapping(address => UserInfo) public userInfo;

    uint256 public totalStaked;
    uint256 public totalUsers;

    event Stake(address indexed user, uint256 amount);
    event Unstake(address indexed user, uint256 amount);
    event Harvest(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    event StakingPeriodUpdated(uint256 newPeriod);
    event EarlyWithdrawalFeeUpdated(uint256 newFee);

    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _rewardRate,
        address _feeRecipient
    ) Ownable(_msgSender()) {
        stakingToken = _stakingToken;
        rewardToken = _rewardToken;
        rewardRate = _rewardRate;
        feeRecipient = _feeRecipient;
        lastUpdateTime = block.timestamp;
    }

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;

        if (_account != address(0)) {
            UserInfo storage user = userInfo[_account];
            user.pendingRewards = earned(_account);
            user.rewardDebt = (user.stakedAmount * rewardPerTokenStored) / 1e18;
        }
        _;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }

        return
            rewardPerTokenStored +
            (((block.timestamp - lastUpdateTime) * rewardRate * 1e18) /
                totalStaked);
    }

    function earned(address _account) public view returns (uint256) {
        UserInfo storage user = userInfo[_account];
        uint256 currentRewardPerToken = rewardPerToken();
        uint256 pendingAmount = (user.stakedAmount *
            (currentRewardPerToken - user.rewardDebt / 1e18)) / 1e18;
        return user.pendingRewards + pendingAmount;
    }

    function stake(uint256 _amount) external updateReward(msg.sender) {
        require(_amount > 0, "Cannot stake 0");

        UserInfo storage user = userInfo[msg.sender];

        if (user.stakedAmount == 0) {
            totalUsers++;
        }

        totalStaked += _amount;
        user.stakedAmount += _amount;
        user.lastStakeTime = block.timestamp;

        IERC20(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        emit Stake(msg.sender, _amount);
    }

    function unstake(uint256 _amount) external updateReward(msg.sender) {
        UserInfo storage user = userInfo[msg.sender];
        require(user.stakedAmount >= _amount, "Insufficient staked amount");

        // Calculate fees if withdrawn early
        uint256 feeAmount = 0;
        if (block.timestamp < user.lastStakeTime + stakingPeriod) {
            feeAmount = (_amount * earlyWithdrawalFee) / 100;
        }

        totalStaked -= _amount;
        user.stakedAmount -= _amount;

        // Transfer tokens minus fees
        uint256 transferAmount = _amount - feeAmount;
        IERC20(stakingToken).safeTransfer(msg.sender, transferAmount);

        // Transfer fees if any
        if (feeAmount > 0 && feeRecipient != address(0)) {
            IERC20(stakingToken).safeTransfer(feeRecipient, feeAmount);
        }

        if (user.stakedAmount == 0) {
            totalUsers--;
        }

        emit Unstake(msg.sender, _amount);
    }

    function harvest() external updateReward(msg.sender) {
        UserInfo storage user = userInfo[msg.sender];
        uint256 reward = user.pendingRewards;

        if (reward > 0) {
            user.pendingRewards = 0;
            IERC20(rewardToken).safeTransfer(msg.sender, reward);
            emit Harvest(msg.sender, reward);
        }
    }

    // Harvest and unstake all at once
    function exit() external updateReward(msg.sender) {
        UserInfo storage user = userInfo[msg.sender];
        uint256 amount = user.stakedAmount;

        if (amount > 0) {
            // Calculate fees if withdrawn early
            uint256 feeAmount = 0;
            if (block.timestamp < user.lastStakeTime + stakingPeriod) {
                feeAmount = (amount * earlyWithdrawalFee) / 100;
            }

            totalStaked -= amount;
            user.stakedAmount = 0;

            // Transfer tokens minus fees
            uint256 transferAmount = amount - feeAmount;
            IERC20(stakingToken).safeTransfer(msg.sender, transferAmount);

            // Transfer fees if any
            if (feeAmount > 0 && feeRecipient != address(0)) {
                IERC20(stakingToken).safeTransfer(feeRecipient, feeAmount);
            }

            totalUsers--;

            emit Unstake(msg.sender, amount);
        }

        // Handle rewards
        uint256 reward = user.pendingRewards;
        if (reward > 0) {
            user.pendingRewards = 0;
            IERC20(rewardToken).safeTransfer(msg.sender, reward);
            emit Harvest(msg.sender, reward);
        }
    }

    // Admin functions
    function setRewardRate(
        uint256 _rewardRate
    ) external onlyOwner updateReward(address(0)) {
        rewardRate = _rewardRate;
        emit RewardRateUpdated(_rewardRate);
    }

    function setStakingPeriod(uint256 _stakingPeriod) external onlyOwner {
        stakingPeriod = _stakingPeriod;
        emit StakingPeriodUpdated(_stakingPeriod);
    }

    function setEarlyWithdrawalFee(
        uint256 _earlyWithdrawalFee
    ) external onlyOwner {
        require(_earlyWithdrawalFee <= 30, "Fee too high");
        earlyWithdrawalFee = _earlyWithdrawalFee;
        emit EarlyWithdrawalFeeUpdated(_earlyWithdrawalFee);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    // Emergency functions
    function recoverERC20(address _token, uint256 _amount) external onlyOwner {
        require(_token != stakingToken, "Cannot recover staking token");
        IERC20(_token).safeTransfer(owner(), _amount);
    }

    // Fund the contract with reward tokens
    function fundRewards(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be positive");
        IERC20(rewardToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
    }

    // Update staking token address (only if no tokens are staked)
    function setStakingToken(address _newToken) external onlyOwner {
        require(
            totalStaked == 0,
            "Cannot change token while tokens are staked"
        );
        stakingToken = _newToken;
    }

    // Update reward token address
    function setRewardToken(
        address _newToken
    ) external onlyOwner updateReward(address(0)) {
        rewardToken = _newToken;
    }
}
