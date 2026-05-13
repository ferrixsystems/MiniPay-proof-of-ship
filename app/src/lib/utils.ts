import { formatUnits } from 'viem'

export function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function shortHash(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`
}

export function randomReference(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}

export function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function getWalletName(ethereum: any): string {
  if (!ethereum) return 'Not detected'
  if (ethereum.isMiniPay) return 'MiniPay'
  if (ethereum.isRabby) return 'Rabby'
  if (ethereum.isMetaMask) return 'MetaMask'
  return 'Injected wallet'
}

export function toUserError(error: any): string {
  if (error?.code === 4001) return 'Request was canceled in your wallet.'
  const raw = String(error?.shortMessage || error?.message || '')
  if (/user rejected|denied/i.test(raw)) return 'Request was canceled in your wallet.'
  if (/insufficient funds/i.test(raw)) return 'Insufficient balance to pay gas or token amount.'
  return raw || 'Payment failed.'
}

export function formatAmount(value: bigint, decimals: number, symbol: string) {
  const formatted = Number(formatUnits(value, decimals))
  const pretty = Number.isFinite(formatted)
    ? formatted.toLocaleString('en-US', { maximumFractionDigits: 4 })
    : formatUnits(value, decimals)
  return `${pretty} ${symbol}`
}

export function timeAgo(fromMs: number, nowMs: number) {
  const sec = Math.max(1, Math.floor((nowMs - fromMs) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

export function getNetworkLabel(chainId: string): string {
  if (chainId?.toLowerCase() === '0xa4ec') return 'Celo Mainnet'
  return `Chain ${chainId}`
}

export function sanitizeAmount(value: string) {
  const normalized = value.replace(/,/g, '.').trim()
  if (!normalized || Number(normalized) <= 0) return ''
  return normalized
}

export function buildPaymentLink(amount: string, token: string, note: string) {
  const url = new URL(`${window.location.origin}${window.location.pathname}`)
  const cleanAmount = sanitizeAmount(amount)
  if (cleanAmount) url.searchParams.set('amount', cleanAmount)
  else url.searchParams.delete('amount')
  url.searchParams.set('token', token)
  url.searchParams.set('view', 'request')
  if (note.trim()) url.searchParams.set('note', note.trim())
  else url.searchParams.delete('note')
  return url.toString()
}
