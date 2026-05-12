// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract Pix2CeloVault {
    event PaymentReceived(
        address indexed payer,
        address indexed token,
        uint256 amount,
        bytes32 indexed paymentRef,
        string note
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    error InvalidTreasury();
    error InvalidAmount();
    error NotOwner();
    error TransferFailed();

    address public owner;
    address public treasury;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner, address initialTreasury) {
        if (initialOwner == address(0) || initialTreasury == address(0)) revert InvalidTreasury();
        owner = initialOwner;
        treasury = initialTreasury;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury);
    }

    function pay(address token, uint256 amount, bytes32 paymentRef, string calldata note) external {
        if (amount == 0) revert InvalidAmount();
        bool ok = IERC20(token).transferFrom(msg.sender, treasury, amount);
        if (!ok) revert TransferFailed();
        emit PaymentReceived(msg.sender, token, amount, paymentRef, note);
    }
}
