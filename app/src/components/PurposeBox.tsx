export function PurposeBox() {
  return (
    <section className="purposeBox">
      <h3>What this app does</h3>
      <p>
        Celo Stable Pay is a simple checkout rail: users pay in USDC/USDT, merchants receive funds in treasury,
        and every payment is publicly verifiable on CeloScan.
      </p>
      <div className="purposeSteps">
        <div>
          <span>1</span>
          <strong>Connect wallet</strong>
          <small>Use MiniPay or your browser wallet on Celo Mainnet.</small>
        </div>
        <div>
          <span>2</span>
          <strong>Choose token & amount</strong>
          <small>Select USDC or USDT and confirm payment.</small>
        </div>
        <div>
          <span>3</span>
          <strong>Get onchain proof</strong>
          <small>Track every transaction live in the activity feed below.</small>
        </div>
      </div>
    </section>
  )
}
