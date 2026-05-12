import type { ConnectStep } from '../lib/types'

type ConnectModalProps = {
  open: boolean
  connecting: boolean
  step: ConnectStep
  onClose: () => void
  onConnectChoice: () => void
}

export function ConnectModal(props: ConnectModalProps) {
  const { open, connecting, step, onClose, onConnectChoice } = props
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
              <button className="walletChoice" onClick={onConnectChoice}>
                <span>◉</span>
                <div>
                  <strong>MiniPay / Injected</strong>
                  <small>Best for mobile-first flow</small>
                </div>
              </button>
              <button className="walletChoice" onClick={onConnectChoice}>
                <span>◉</span>
                <div>
                  <strong>Rabby / MetaMask</strong>
                  <small>Desktop browser extension</small>
                </div>
              </button>
            </div>
          </>
        )}

        {step === 'confirming' && (
          <div className="confirmStage">
            <div className="spinner" />
            <p>Waiting for wallet confirmation...</p>
            <small>Approve the request in your wallet popup to connect.</small>
          </div>
        )}
      </div>
    </div>
  )
}
