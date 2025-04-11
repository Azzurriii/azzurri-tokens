// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMint {
    function mint(address to, uint256 _level) external;
}

contract INO is Ownable {
    using SafeERC20 for IERC20;
    address public nft;
    address public treasury;
    uint256 public priceBNB;
    uint256 private nonce = 0;

    constructor(
        address _nft,
        address _treasury,
        uint256 _priceBNB
    ) Ownable(_msgSender()) {
        nft = _nft;
        treasury = _treasury;
        priceBNB = _priceBNB;
    }

    event SetPrice(uint256 price, string typePrice, uint256 blockTime);
    event SetTreasury(address treasury, uint256 blockTime);
    event Buy(uint256 price, string typeBuy, uint256 blockTime);

    struct Level {
        uint256 maxLevel1; // Common
        uint256 maxLevel2; // Uncommon
        uint256 maxLevel3; // Rare
        uint256 maxLevel4; // Epic
        uint256 maxLevel5; // Legendary
    }

    Level public level;

    function setLevel(Level calldata _level) external onlyOwner {
        level.maxLevel1 = _level.maxLevel1;
        level.maxLevel2 = _level.maxLevel2;
        level.maxLevel3 = _level.maxLevel3;
        level.maxLevel4 = _level.maxLevel4;
        level.maxLevel5 = _level.maxLevel5;
    }

    function setPriceBNB(uint256 _price) external onlyOwner {
        priceBNB = _price;
        emit SetPrice(_price, "bnb", block.timestamp);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit SetTreasury(_treasury, block.timestamp);
    }

    function buyWithBNB(uint256 amount) external payable {
        uint256 value = amount * priceBNB;
        require(value == msg.value, "Amount Wrong");
        (bool success, ) = payable(treasury).call{value: value}("");
        require(success, "Transfer failed.");
        for (uint256 i = 0; i < amount; i++) {
            uint256 levelTokenId = randomLevel();
            IMint(nft).mint(msg.sender, levelTokenId);
            emit Buy(priceBNB, "bnb", block.timestamp);
        }
    }

    function randomLevel() internal returns (uint256) {
        unchecked {
            nonce++;
        }
        uint256 randomValue = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    msg.sender,
                    gasleft(),
                    nonce
                )
            )
        ) % level.maxLevel5;

        if (randomValue < level.maxLevel1) return 1;
        if (randomValue < level.maxLevel2) return 2;
        if (randomValue < level.maxLevel3) return 3;
        if (randomValue < level.maxLevel4) return 4;
        return 5;
    }
}
