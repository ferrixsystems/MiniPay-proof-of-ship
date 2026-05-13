import type { TokenMeta } from '../lib/types'

type PaymentFormProps = {
  tokenSymbol: string
  tokens: TokenMeta[]
  amount: string
  note: string
  quickAmounts: string[]
  loading: boolean
  connected: boolean
  paymentLink: string
  paymentLinkReady: boolean
  linkCopied: boolean
  requestLoaded: boolean
  onAmountSelect: (v: string) => void
  onAmountChange: (v: string) => void
  onTokenChange: (v: string) => void
  onNoteChange: (v: string) => void
  onPay: () => void
  onCopyPaymentLink: () => void
  onSharePaymentLink: () => void
  onOpenPaymentLink: () => void
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
    paymentLink,
    paymentLinkReady,
    linkCopied,
    requestLoaded,
    onAmountSelect,
    onAmountChange,
    onTokenChange,
    onNoteChange,
    onPay,
    onCopyPaymentLink,
    onSharePaymentLink,
    onOpenPaymentLink
  } = props

  const validAmount = Number(amount) > 0
  const payLabel = !validAmount ? 'Enter an amount' : loading ? 'Processing transaction...' : `Pay ${amount} ${tokenSymbol}`
  const cleanLink = paymentLink.replace(/^https?:\/\//, '')

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

      <div className="paymentLinkBox">
        <div className="requestTopline">
          <span className="metaLabel">{requestLoaded ? 'Loaded request' : 'Payment request link'}</span>
          <span className={paymentLinkReady ? 'requestState ready' : 'requestState'}>{paymentLinkReady ? 'Ready' : 'Needs amount'}</span>
        </div>

        <div className="requestPreview">
          <div className="paymentLinkIcon" aria-hidden="true">
            Pay
          </div>
          <div className="paymentLinkContent">
            <strong>
              {paymentLinkReady ? amount : '--'} {tokenSymbol}
            </strong>
            <p>{note || 'Stablecoin payment request'}</p>
          </div>
        </div>

        <div className="requestUrl" title={paymentLink}>
          {paymentLinkReady ? cleanLink : 'Set an amount to generate a shareable checkout link'}
        </div>
        <p className="requestHint">This link opens the checkout with amount, token and note prefilled.</p>

        <div className="paymentLinkActions">
          <button type="button" className="secondary compact" onClick={onCopyPaymentLink} disabled={!paymentLinkReady}>
            {linkCopied ? 'Copied' : 'Copy link'}
          </button>
          <button type="button" className="secondary compact" onClick={onSharePaymentLink} disabled={!paymentLinkReady}>
            Share
          </button>
          <button type="button" className="secondary compact ghost" onClick={onOpenPaymentLink} disabled={!paymentLinkReady}>
            Preview
          </button>
        </div>
      </div>

      <button id="pay-request-btn" disabled={!connected || loading || !validAmount} onClick={onPay} className="primary">
        {payLabel}
      </button>
    </>
  )
}
