import type { LivePayment, TokenMeta } from '../lib/types'
import { formatAmount, shortAddress, shortHash, timeAgo } from '../lib/utils'

type TopSender = { payer: string; total: bigint }

type LiveBoardProps = {
  livePayments: LivePayment[]
  pages: LivePayment[][]
  pageCount: number
  slideIndex: number
  setSlideIndex: (idx: number) => void
  feedStatus: 'idle' | 'syncing' | 'live' | 'error'
  feedError: string
  autoRefreshSeconds: number
  lastRefreshAt: number | null
  clock: number
  tokenByAddress: Map<string, TokenMeta>
  tokenSymbol: string
  topSenders: TopSender[]
  token?: TokenMeta
  onRefresh: () => void
}

export function LiveBoard(props: LiveBoardProps) {
  const {
    livePayments,
    pages,
    pageCount,
    slideIndex,
    setSlideIndex,
    feedStatus,
    feedError,
    autoRefreshSeconds,
    lastRefreshAt,
    clock,
    tokenByAddress,
    tokenSymbol,
    topSenders,
    token,
    onRefresh
  } = props

  const selectedPayments = token
    ? livePayments.filter((payment) => payment.token.toLowerCase() === token.address.toLowerCase())
    : livePayments
  const totalVolume = selectedPayments.reduce((total, payment) => total + payment.amount, 0n)
  const activeSenders = new Set(selectedPayments.map((payment) => payment.payer.toLowerCase())).size
  const totalVolumeLabel = token ? formatAmount(totalVolume, token.decimals, token.symbol) : '0 TOKEN'

  return (
    <section className="liveBoard">
      <div className="liveHero">
        <div>
          <span className="eyebrow">Onchain activity</span>
          <h2>Live Payment Stream</h2>
          <p>Track confirmed USDC and USDT payments from the vault contract in real time.</p>
        </div>
        <div className="liveMeta">
          <span className={feedStatus === 'live' ? 'liveDot on' : 'liveDot'} />
          <span>{feedStatus === 'syncing' ? 'Syncing...' : feedStatus === 'live' ? 'Live' : 'Offline'}</span>
          <span className="muted">Refresh {autoRefreshSeconds}s</span>
          {lastRefreshAt && <span className="muted">Updated {timeAgo(lastRefreshAt, clock)}</span>}
          <button type="button" className="iconTextBtn" onClick={onRefresh}>
            Refresh now
          </button>
        </div>
      </div>

      {feedError && (
        <p className="feedNotice">
          RPC temporarily unavailable. Showing the latest indexed data while the feed retries.
        </p>
      )}

      <div className="liveStats">
        <div>
          <span>Total volume</span>
          <strong>{totalVolumeLabel}</strong>
        </div>
        <div>
          <span>Recent payments</span>
          <strong>{livePayments.length}</strong>
        </div>
        <div>
          <span>Active senders</span>
          <strong>{activeSenders}</strong>
        </div>
      </div>

      <div className="liveGrid">
        <div className="activityPanel">
          <div className="panelHead">
            <div>
              <span className="eyebrow">Settlement feed</span>
              <h3>Recent Transactions</h3>
            </div>
            <span className="streamBadge">Auto-updating</span>
          </div>

          <div className="sliderViewport">
            {pages.length === 0 ? (
              <div className="emptyFeed">
                <div className="emptyPulse" />
                <strong>No payments detected yet</strong>
                <span>This stream only shows onchain events emitted by your configured vault contract.</span>
              </div>
            ) : (
              <div className="slideTrack" style={{ transform: `translateX(-${slideIndex * 100}%)` }}>
                {pages.map((group, idx) => (
                  <div className={`slidePage ${group.length === 1 ? 'single' : ''}`} key={idx}>
                    {group.map((payment) => {
                      const tokenMeta = tokenByAddress.get(payment.token.toLowerCase())
                      const symbol = tokenMeta?.symbol || 'TOKEN'
                      const decimals = tokenMeta?.decimals ?? 18
                      return (
                        <article className="betCard" key={`${payment.txHash}:${payment.logIndex}`}>
                          <div className="betHead">
                            <span className="payerBadge">{shortAddress(payment.payer)}</span>
                            <span>{timeAgo(payment.blockTimestampMs, clock)}</span>
                          </div>
                          <p className="betNote">{payment.note || 'Onchain payment'}</p>
                          <div className="betFoot">
                            <a href={`https://celoscan.io/tx/${payment.txHash}`} target="_blank" rel="noreferrer">
                              {shortHash(payment.txHash)}
                            </a>
                            <strong>{formatAmount(payment.amount, decimals, symbol)}</strong>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sliderDots">
            {Array.from({ length: pageCount }).map((_, idx) => (
              <button
                key={idx}
                className={idx === slideIndex ? 'dot active' : 'dot'}
                onClick={() => setSlideIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="liveBottom">
            <span>{livePayments.length} recent payments</span>
            <span>Live ranking by token: {tokenSymbol}</span>
          </div>
        </div>

        <aside className="topBox">
          <span className="eyebrow">Leaderboard</span>
          <h3>Top Senders ({tokenSymbol})</h3>
          {topSenders.length === 0 || !token ? (
            <div className="leaderEmpty">
              <span>--</span>
              <p>No ranking data yet for {tokenSymbol}.</p>
            </div>
          ) : (
            <ol className="leaderboard">
              {topSenders.map((sender, idx) => (
                <li key={sender.payer}>
                  <span className="rank">#{idx + 1}</span>
                  <span>{shortAddress(sender.payer)}</span>
                  <strong>{formatAmount(sender.total, token.decimals, token.symbol)}</strong>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  )
}
