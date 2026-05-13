import type { ConnectStep } from '../lib/types'
import type { WalletTarget } from '../lib/utils'

type ConnectModalProps = {
  open: boolean
  connecting: boolean
  step: ConnectStep
  walletConnectUri: string
  onClose: () => void
  onConnectChoice: (target: WalletTarget) => void
}

export function ConnectModal(props: ConnectModalProps) {
  const { open, connecting, step, walletConnectUri, onClose, onConnectChoice } = props
  if (!open) return null

  return (
    <div className="modalOverlay" onClick={() => !connecting && onClose()}>
      <div className="connectModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead">
          <div className="modalTitle">
            <img src="/image.png" alt="" className="modalImage" />
            <h3>Connect Wallet</h3>
          </div>
          <button className="closeModal" onClick={() => !connecting && onClose()} disabled={connecting} aria-label="Close">
            ×
          </button>
        </div>

        {step === 'select' && (
          <>
            <p className="modalSub">Choose your wallet to continue on Celo Mainnet.</p>
            <div className="walletChoices">
              <button className="walletChoice" onClick={() => onConnectChoice('minipay')}>
                <span>◉</span>
                <div>
                  <strong>MiniPay</strong>
                  <small>Force MiniPay provider</small>
                </div>
              </button>
              <button className="walletChoice" onClick={() => onConnectChoice('browser')}>
                <span>◉</span>
                <div>
                  <strong>Rabby / MetaMask</strong>
                  <small>Use browser extension wallet</small>
                </div>
              </button>
              <button className="walletChoice" onClick={() => onConnectChoice('walletconnect')}>
                <span>◉</span>
                <div>
                  <strong>WalletConnect (QR)</strong>
                  <small>Scan with a wallet app (not phone camera)</small>
                </div>
              </button>
            </div>
          </>
        )}

        {step === 'confirming' && (
          <div className="confirmStage">
            <div className="spinner" />
            <p>{walletConnectUri ? 'Scan QR code in your wallet app' : 'Waiting for wallet confirmation...'}</p>
            <small>
              {walletConnectUri ? 'If QR does not open automatically, scan this code with WalletConnect compatible wallet.' : 'Approve the request in your wallet popup to connect.'}
            </small>
            {walletConnectUri && (
              <div className="qrWrap">
                <img
                  className="qrCode"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(walletConnectUri)}`}
                  alt="WalletConnect QR code"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
