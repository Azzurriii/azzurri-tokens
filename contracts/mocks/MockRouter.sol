// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IDEXRouter {
    function factory() external view returns (address);
    function WETH() external view returns (address);
}

contract MockRouter is IDEXRouter {
    function factory() external view override returns (address) {
        return address(this);
    }

    function WETH() external view override returns (address) {
        return address(this);
    }

    // Add fallback and receive functions to handle incoming transactions
    fallback() external payable {}
    receive() external payable {}
}
