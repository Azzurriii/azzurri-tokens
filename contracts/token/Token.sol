// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IDEXRouter {
    function factory() external view returns (address);
    function WETH() external view returns (address);
}

interface IDEXFactory {
    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair);
}

contract Token is ERC20, Ownable {
    uint256 public buyFee;
    uint256 public sellFee;
    uint256 public feeEndTime;
    uint256 public constant FEE_DENOMINATOR = 100;
    uint256 public maxSupply;
    mapping(address => bool) public pair;
    mapping(address => bool) public minter;
    mapping(address => bool) private _isExcludedFromFee;

    modifier onlyMinter() {
        require(minter[_msgSender()], "Only Minter");
        _;
    }

    event SetFees(uint256 buyFee, uint256 sellFee);

    constructor(
        string memory name,
        string memory symbol,
        uint256 _buyFee,
        uint256 _sellFee,
        uint256 _maxSupply,
        uint256 initialSupply,
        uint256 _feeEndTime,
        address _router
    ) ERC20(name, symbol) Ownable(_msgSender()) {
        _isExcludedFromFee[msg.sender] = true;
        buyFee = _buyFee;
        sellFee = _sellFee;
        maxSupply = _maxSupply;
        feeEndTime = _feeEndTime;

        try IDEXRouter(_router).factory() returns (address factoryAddress) {
            if (factoryAddress != address(0)) {
                try
                    IDEXFactory(factoryAddress).createPair(
                        IDEXRouter(_router).WETH(),
                        address(this)
                    )
                returns (address _pair) {
                    pair[_pair] = true;
                } catch {
                    revert("Failed to create pair");
                }
            }
        } catch {
            revert("Failed to create pair");
        }

        _mint(msg.sender, initialSupply);
    }

    function setMiner(address _minter, bool status) external onlyOwner {
        minter[_minter] = status;
    }

    function setPair(address _pair, bool status) external onlyOwner {
        pair[_pair] = status;
    }

    function setFeeEndTime(uint256 _feeEndTime) external onlyOwner {
        feeEndTime = _feeEndTime;
    }

    function setBuySellFee(
        uint256 _buyFee,
        uint256 _sellFee
    ) external onlyOwner {
        require(_buyFee <= 20 && _sellFee <= 20, "Max fee is 20%");
        buyFee = _buyFee;
        sellFee = _sellFee;
        emit SetFees(_buyFee, _sellFee);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        _mint(to, amount);
    }

    function transfer(
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address sender = _msgSender();
        uint256 feeAmount = 0;

        if (
            !_isExcludedFromFee[sender] &&
            !_isExcludedFromFee[to] &&
            block.timestamp <= feeEndTime
        ) {
            if (pair[sender]) {
                feeAmount = (amount * buyFee) / FEE_DENOMINATOR;
            } else if (pair[to]) {
                feeAmount = (amount * sellFee) / FEE_DENOMINATOR;
            }
        }

        if (feeAmount > 0) {
            _transfer(sender, address(this), feeAmount);
            _transfer(sender, to, amount - feeAmount);
        } else {
            _transfer(sender, to, amount);
        }

        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);

        uint256 feeAmount = 0;

        if (
            !_isExcludedFromFee[from] &&
            !_isExcludedFromFee[to] &&
            block.timestamp <= feeEndTime
        ) {
            if (pair[from]) {
                feeAmount = (amount * buyFee) / FEE_DENOMINATOR;
            } else if (pair[to]) {
                feeAmount = (amount * sellFee) / FEE_DENOMINATOR;
            }
        }

        if (feeAmount > 0) {
            _transfer(from, address(this), feeAmount);
            _transfer(from, to, amount - feeAmount);
        } else {
            _transfer(from, to, amount);
        }

        return true;
    }

    function excludeFromFee(address account, bool excluded) external onlyOwner {
        _isExcludedFromFee[account] = excluded;
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        _transfer(address(this), owner(), balance);
    }
}
