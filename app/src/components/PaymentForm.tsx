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
  onPayWithQr: () => void
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
    onPay,
    onPayWithQr
  } = props

  const validAmount = Number(amount) > 0
  const payLabel = !validAmount
    ? 'Enter an amount'
    : !connected
      ? 'Connect wallet to pay'
      : loading
        ? 'Confirming payment...'
        : `Pay ${amount} ${tokenSymbol}`

  return (
    <>
      <div className="formSectionHead">
        <span className="eyebrow">Payment request</span>
        <strong>Build checkout link</strong>
      </div>

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
      <input value={note} onChange={(e) => onNoteChange(e.target.value)} maxLength={120} placeholder="Invoice, order ID or payment purpose" />

      <button id="pay-request-btn" disabled={!connected || loading || !validAmount} onClick={onPay} className="primary">
        {payLabel}
      </button>

      <button type="button" className="secondary qrConnectBtn" onClick={onPayWithQr} disabled={!validAmount}>
        Pay with QR code
      </button>
    </>
  )
}
