import type { TokenMeta } from '../lib/types'

type PaymentFormProps = {
  tokenSymbol: string
  tokens: TokenMeta[]
  amount: string
  note: string
  quickAmounts: string[]
  loading: boolean
  connected: boolean
  onAmountSelect: (v: string) => void
  onAmountChange: (v: string) => void
  onTokenChange: (v: string) => void
  onNoteChange: (v: string) => void
  onPay: () => void
}

export function PaymentForm(props: PaymentFormProps) {
  const {
    tokenSymbol,
    tokens,
    amount,
    note,
    quickAmounts,
    loading,
    connected,
    onAmountSelect,
    onAmountChange,
    onTokenChange,
    onNoteChange,
    onPay
  } = props

  return (
    <>
      <label>Amount ({tokenSymbol})</label>
      <div className="row">
        {quickAmounts.map((v) => (
          <button key={v} className={amount === v ? 'chip selected' : 'chip'} onClick={() => onAmountSelect(v)}>
            {v} {tokenSymbol}
          </button>
        ))}
      </div>
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value.replace(/,/g, '.'))}
        placeholder={`Enter ${tokenSymbol} amount`}
      />

      <label>Token</label>
      <select value={tokenSymbol} onChange={(e) => onTokenChange(e.target.value)}>
        {tokens.map((t) => (
          <option key={t.symbol} value={t.symbol}>
            {t.symbol}
          </option>
        ))}
      </select>

      <label>Description</label>
      <input value={note} onChange={(e) => onNoteChange(e.target.value)} maxLength={120} />

      <button disabled={!connected || loading} onClick={onPay} className="primary">
        {loading ? 'Processing transaction...' : `Pay ${amount || '0'} ${tokenSymbol}`}
      </button>
    </>
  )
}
