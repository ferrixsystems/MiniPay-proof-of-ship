import { shortAddress } from '../lib/utils'

type PaymentQrModalProps = {
  open: boolean
  amount: string
  tokenSymbol: string
  note: string
  paymentUri: string
  tokenAddress: string
  recipientAddress: string
  onClose: () => void
}

export function PaymentQrModal(props: PaymentQrModalProps) {
  const { open, amount, tokenSymbol, note, paymentUri, tokenAddress, recipientAddress, onClose } = props
  if (!open) return null

  const qrUrl = paymentUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(paymentUri)}`
    : ''

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="paymentQrModal" onClick={(event) => event.stopPropagation()}>
        <div className="modalHead">
          <div className="modalTitle">
            <img src="/image.png" alt="" className="modalImage" />
            <h3>Pay with QR code</h3>
          </div>
          <button className="closeModal" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className="paymentQrBody">
          {qrUrl ? (
            <img className="paymentQrImage" src={qrUrl} alt={`${tokenSymbol} transfer QR code`} />
          ) : (
            <div className="paymentQrEmpty">Payment QR is not ready. Check token and vault configuration.</div>
          )}
          <div className="paymentQrSummary">
            <span>Wallet transfer request</span>
            <strong>
              {amount} {tokenSymbol}
            </strong>
            <p>{note || 'Stablecoin payment'}</p>
            {recipientAddress && tokenAddress && (
              <div className="paymentQrMeta">
                <span>To</span>
                <strong>{shortAddress(recipientAddress)}</strong>
                <span>Token</span>
                <strong>{shortAddress(tokenAddress)}</strong>
              </div>
            )}
          </div>
          <p className="paymentQrHint">
            Scan with any wallet that supports ERC-681 token payment QR. The QR includes Celo Mainnet, token contract, recipient and
            amount.
          </p>
          {paymentUri && <code className="paymentUriText">{paymentUri}</code>}
        </div>
      </div>
    </div>
  )
}
