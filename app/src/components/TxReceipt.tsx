type TxReceiptProps = {
  txHash: string
  txUrl: string
  copied: boolean
  onCopy: () => void
}

export function TxReceipt(props: TxReceiptProps) {
  const { txHash, txUrl, copied, onCopy } = props
  if (!txHash) return null

  return (
    <div className="txCard">
      <p className="txTitle">Payment confirmed</p>
      <p className="txHash">{txHash}</p>
      <div className="txActions">
        <button className="secondary" onClick={onCopy}>{copied ? 'Copied' : 'Copy hash'}</button>
        <a className="secondary link" href={txUrl} target="_blank" rel="noreferrer">View on CeloScan</a>
      </div>
    </div>
  )
}
