# Pix2Celo Recarga - Proof of Ship Submission

Mini app para MiniPay que permite pagamentos/recargas em stablecoin (USDC/USDT) e registra comprovante onchain via smart contract na Celo.

## Objetivo para Proof of Ship

Este projeto foi desenhado para cumprir os requisitos:

1. Build for MiniPay
2. Deploy on Celo mainnet
3. Submit project on Talent

## Arquitetura

- `contracts/`: contrato Solidity (`Pix2CeloVault`) para receber pagamento e encaminhar para tesouraria.
- `app/`: mini app em React + Vite + viem com conexão wallet e fluxo approve + pay.
- `docs/`: guia de submissão e checklist.

## Smart Contract

Contrato principal: `contracts/src/Pix2CeloVault.sol`

Funções:
- `setTreasury(address)`: atualiza carteira recebedora
- `pay(address token, uint256 amount, bytes32 reference, string note)`: transfere token do usuário para tesouraria e emite evento

Evento emitido:
- `PaymentReceived(payer, token, amount, reference, note)`

## Rodando localmente

### 1) Frontend

```bash
cd app
cp .env.example .env
pnpm install
pnpm dev
```

### 2) Contrato (Foundry)

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std
forge test
```

## Deploy na Celo Mainnet

No diretório `contracts`, configure variáveis:

```bash
export CELO_RPC_URL="https://forno.celo.org"
export PRIVATE_KEY="<sua_private_key>"
export OWNER_ADDRESS="0x..."
export TREASURY_ADDRESS="0x..."
```

Deploy:

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url $CELO_RPC_URL --broadcast --verify
```

Depois, coloque o endereço do contrato no `.env` do app (`VITE_CONTRACT_ADDRESS`).

## Compatibilidade MiniPay

- Verifica `window.ethereum`
- Força rede Celo (`0xa4ec`)
- Fluxo de pagamento com stablecoin e comprovante de tx hash

## Entrega para Talent

Veja o checklist final em `docs/submission-checklist.md`.

