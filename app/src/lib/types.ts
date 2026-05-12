export type LivePayment = {
  txHash: `0x${string}`
  logIndex: number
  blockNumber: bigint
  blockTimestampMs: number
  payer: `0x${string}`
  token: `0x${string}`
  amount: bigint
  note: string
}

export type TokenMeta = {
  symbol: string
  address: string
  decimals: number
}

export type ConnectStep = 'select' | 'confirming'
export type FeedStatus = 'idle' | 'syncing' | 'live' | 'error'
