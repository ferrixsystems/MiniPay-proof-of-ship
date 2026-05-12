import { shortAddress } from '../lib/utils'

type WalletPanelProps = {
  connected: boolean
  account: string
  walletName: string
  networkName: string
  connecting: boolean
  onConnectClick: () => void
}

export function WalletPanel(props: WalletPanelProps) {
  const { connected, account, walletName, networkName, connecting, onConnectClick } = props

  return (
    <div className="walletPanel">
      <div className="walletHead">
        <div className="walletIdentity">
          <span className={connected ? 'statusDot online' : 'statusDot offline'} />
          <div>
            <p className="walletTitle">Wallet Session</p>
            <strong className="walletAddress">{connected ? shortAddress(account) : 'Not connected'}</strong>
          </div>
        </div>
        <button onClick={onConnectClick} className="connectBtn" disabled={connecting}>
          {connecting ? 'Connecting...' : connected ? 'Switch Wallet' : 'Connect Wallet'}
        </button>
      </div>

      <div className="walletGrid">
        <div>
          <span className="metaLabel">Provider</span>
          <strong>{walletName}</strong>
        </div>
        <div>
          <span className="metaLabel">Network</span>
          <strong>{networkName}</strong>
        </div>
      </div>
    </div>
  )
}
