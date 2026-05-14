import { CONTRACT_ADDRESS, TOKENS } from '../lib/config'
import { shortAddress } from '../lib/utils'

export function ContractStatus() {
  return (
    <section className="contractStatus">
      <div>
        <span className="eyebrow">Settlement vault</span>
        <h3>Verified payment rail</h3>
        <p>Funds are routed through the deployed Celo vault and every payment emits a public receipt event.</p>
      </div>

      <div className="contractStatusGrid">
        <a href={`https://celoscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
          <span>Contract</span>
          <strong>{shortAddress(CONTRACT_ADDRESS)}</strong>
        </a>
        <div>
          <span>Network</span>
          <strong>Celo Mainnet</strong>
        </div>
        <div>
          <span>Tokens</span>
          <strong>{TOKENS.map((token) => token.symbol).join(' / ')}</strong>
        </div>
      </div>
    </section>
  )
}
