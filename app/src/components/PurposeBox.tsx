export function PurposeBox() {
  return (
    <section className="purposeBox">
      <span className="eyebrow">Merchant checkout</span>
      <h3>Accept stablecoin payments on Celo</h3>
      <p>
        Create payment requests in USDC or USDT, route funds to your treasury, and give every payer a public
        onchain receipt.
      </p>
      <div className="purposeSteps">
        <div>
          <span>1</span>
          <strong>Create request</strong>
          <small>Set amount, token and payment purpose.</small>
        </div>
        <div>
          <span>2</span>
          <strong>Share checkout</strong>
          <small>Send a prefilled link to any Celo wallet user.</small>
        </div>
        <div>
          <span>3</span>
          <strong>Track receipts</strong>
          <small>Watch confirmed payments in the live activity panel.</small>
        </div>
      </div>
    </section>
  )
}
