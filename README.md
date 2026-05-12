# Celo Stable Pay - Proof of Ship Submission

MiniPay-ready stablecoin payment app on Celo Mainnet.

## What This Project Does

- Lets users pay in `USDC` or `USDT`.
- Sends payments onchain through a smart contract.
- Returns a verifiable transaction hash and CeloScan link.

## Project Structure

- `contracts/`: Solidity contract (`Pix2CeloVault`) that forwards funds to treasury.
- `app/`: React + Vite + viem frontend.
- `docs/`: submission checklist.

## Smart Contract

Main contract: `contracts/src/Pix2CeloVault.sol`

Core methods:
- `setTreasury(address)`: updates destination wallet.
- `pay(address token, uint256 amount, bytes32 paymentRef, string note)`: transfers user tokens to treasury and emits event.

## Run Locally

```bash
cd app
cp .env.example .env
pnpm install
pnpm dev
```

## Required Env Vars

```env
VITE_CONTRACT_ADDRESS=0x...
VITE_USDC_ADDRESS=0xcebA9300f2b948710d2653dD7B07f33A8B32118C
VITE_USDT_ADDRESS=0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
```

## Deploy Notes

- Contract must be deployed on **Celo Mainnet (42220)**.
- Frontend can be deployed on Vercel with root directory `app`.

## Talent Submission

Use `docs/submission-checklist.md` for final submission artifacts.
