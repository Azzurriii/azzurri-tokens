// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IDEXRouter {
    function WETH() external view returns (address);
}

interface IDEXFactory {
    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair);
}

contract MockFactory is IDEXFactory, IDEXRouter {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    function WETH() external view override returns (address) {
        return address(this);
    }

    function factory() external view returns (address) {
        return address(this);
    }

    function createPair(
        address tokenA,
        address tokenB
    ) external override returns (address pair) {
        pair = address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(tokenA, tokenB, block.timestamp))
                )
            )
        );
        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair;
        allPairs.push(pair);
        return pair;
    }
}
