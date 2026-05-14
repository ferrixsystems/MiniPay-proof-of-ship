type TxReceiptProps = {
  txHash: string
  txUrl: string
  amount: string
  tokenSymbol: string
  note: string
  copied: boolean
  onCopy: () => void
}

export function TxReceipt(props: TxReceiptProps) {
  const { txHash, txUrl, amount, tokenSymbol, note, copied, onCopy } = props
  if (!txHash) return null

  return (
    <div className="txCard">
      <div className="txReceiptHead">
        <div>
          <span className="eyebrow">Onchain receipt</span>
          <p className="txTitle">Payment confirmed</p>
        </div>
        <strong>{amount} {tokenSymbol}</strong>
      </div>
      <div className="txReceiptMeta">
        <span>Description</span>
        <strong>{note || 'Stablecoin payment'}</strong>
      </div>
      <div className="txReceiptMeta">
        <span>Transaction hash</span>
        <p className="txHash">{txHash}</p>
      </div>
      <div className="txActions">
        <button className="secondary" onClick={onCopy}>{copied ? 'Copied' : 'Copy hash'}</button>
        <a className="secondary link" href={txUrl} target="_blank" rel="noreferrer">View on CeloScan</a>
      </div>
    </div>
  )
}
