# Azzurri Token

## Overview

Azzurri is an ERC20 token with built-in transaction fees and a complete ecosystem including staking, NFTs, Initial DEX Offering (IDO), and Initial NFT Offering (INO) functionality.

## Features

### Azzurri Token

- **Name & Symbol**: Azzurri | AZR
- **Fee Mechanism**: 5% buy fee, 7% sell fee
- **Max Supply**: 24,000,000
- **Fee Collection**: Fees are collected in the contract and can be withdrawn by the owner
- **Minting**: Authorized minters can create new tokens up to max supply
- **DEX Integration**: Automatic pair creation with router WETH

### NFT

- **Levels**: 10 levels
- **Custom URIs**: Supports custom base URI for metadata
- **Minting**: Controlled minting through authorized minters
- **Burning**: Token owners can burn their tokens

### Staking NFTs

- **NFT Staking**: Stake your NFTs to participate in the ecosystem
- **User Tracking**: Records of all stakers and their contributions
- **Flexible Withdrawal**: Unstake your NFTs at any time

### Staking Tokens

- **Token Staking**: Stake your tokens to participate in the ecosystem
- **User Tracking**: Records of all stakers and their contributions
- **Flexible Withdrawal**: Unstake your tokens at any time

### IDO (Initial DEX Offering)

- **Token Sale**: Purchase allocation of the Azzurri token
- **Vesting Schedule**: Customizable TGE and vesting parameters
- **Price Configuration**: Set token price and purchase limits

### INO (Initial NFT Offering)

- **Random NFT Purchase**: Buy NFTs with random rarity levels
- **Level Probabilities**: Configurable probability distribution for NFT levels
- **Payment Methods**: Native token (BNB/ETH) support

## Deployment Instructions

### Prerequisites

- Node.js v16 or higher
- Hardhat

### Installation

```bash
npm install
```

### Compile Contracts

```bash
npx hardhat compile
```

### Deploy Contracts

Deploy to a local network:

```bash
npx hardhat node
npx hardhat run scripts/deploy-all.ts --network localhost
```

Deploy to a test network (e.g., BSC Testnet):

```bash
npx hardhat run scripts/deploy-all.ts --network bscTestnet
```

## Contract Parameters

### Azzurri Token

- `name`: Token name (e.g., "Azzurri Token")
- `symbol`: Token symbol (e.g., "AZR")
- `_buyFee`: Fee applied when buying the token (e.g., 5 for 5%)
- `_sellFee`: Fee applied when selling the token (e.g., 7 for 7%)
- `_maxSupply`: Maximum token supply
- `initialSupply`: Initial amount to mint to deployer
- `_feeEndTime`: Unix timestamp when fees should end
- `_router`: DEX router address for pair creation

### NFT

- `name`: NFT collection name
- `symbol`: NFT collection symbol
- `_maxLevel`: Maximum rarity level (e.g., 10)
- `_baseUri`: Base URI for token metadata

### NFT Staking

- `_nft`: Address of the NFT contract

### Token Staking

- `_stakingToken`: Address of the token to be staked
- `_rewardToken`: Address of the reward token
- `_rewardRate`: Reward rate per second
- `_treasury`: Treasury address

### IDO

- `_start`: Start time (Unix timestamp)
- `_end`: End time (Unix timestamp)
- `_token`: Token address
- `_tokenPrice`: Token price (in payment token units)
- `_startRelease`: Release start time (Unix timestamp)
- `_cliff`: Cliff period (in seconds)
- `_vesting`: Vesting period (in seconds)
- `_tge`: Initial unlock percentage (0-100)
- `_purchaseLimit`: Maximum purchase amount per user
- `_cap`: Total sale cap
- `_tokenPayment`: Payment token address
- `_treasury`: Treasury address

### INO

- `_nft`: NFT contract address
- `_treasury`: Treasury address
- `_priceBNB`: Price in native token per NFT

## Security Considerations

- The random number generation in INO.sol uses on-chain data sources which are predictable. For production, consider using Chainlink VRF or similar solution.
- Review and set appropriate fee limits to ensure fairness to users.
- Set appropriate vesting schedules to align with project roadmap.

## License

MIT
