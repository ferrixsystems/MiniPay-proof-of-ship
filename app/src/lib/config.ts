export const APP_NAME = 'Celo Stable Pay'

export const CELO_CHAIN_ID_HEX = '0xa4ec'
export const CELO_RPC_URL = import.meta.env.VITE_CELO_RPC_URL || ''

export const TOKENS = [
  {
    symbol: 'USDC',
    address: import.meta.env.VITE_USDC_ADDRESS || '',
    decimals: 6
  },
  {
    symbol: 'USDT',
    address: import.meta.env.VITE_USDT_ADDRESS || '',
    decimals: 6
  }
]

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ''
