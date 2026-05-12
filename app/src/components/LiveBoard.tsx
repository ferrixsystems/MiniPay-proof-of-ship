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
    token
  } = props

  return (
    <section className="liveBoard card">
      <div className="liveHead">
        <h2>Recent Payments</h2>
        <div className="liveMeta">
          <span className={feedStatus === 'live' ? 'liveDot on' : 'liveDot'} />
          <span>{feedStatus === 'syncing' ? 'Syncing...' : feedStatus === 'live' ? 'Live' : 'Offline'}</span>
          <span className="muted">Auto-refresh {autoRefreshSeconds}s</span>
          {lastRefreshAt && <span className="muted">Updated {timeAgo(lastRefreshAt, clock)}</span>}
        </div>
      </div>

      {feedError && <p className="err small">{feedError}</p>}

      <div className="sliderViewport">
        {pages.length === 0 ? (
          <div className="slideTrack" style={{ transform: 'translateX(0%)' }}>
            <div className="slidePage">
              <div className="betCard emptyCard">No payments detected yet.</div>
            </div>
          </div>
        ) : (
          <div className="slideTrack" style={{ transform: `translateX(-${slideIndex * 100}%)` }}>
            {pages.map((group, idx) => (
              <div className="slidePage" key={idx}>
                {group.map((payment) => {
                  const tokenMeta = tokenByAddress.get(payment.token.toLowerCase())
                  const symbol = tokenMeta?.symbol || 'TOKEN'
                  const decimals = tokenMeta?.decimals ?? 18
                  return (
                    <article className="betCard" key={`${payment.txHash}:${payment.logIndex}`}>
                      <div className="betHead">
                        <strong>{shortAddress(payment.payer)}</strong>
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

      <div className="topBox">
        <h3>Top Senders ({tokenSymbol})</h3>
        {topSenders.length === 0 || !token ? (
          <p className="empty">No ranking data yet for {tokenSymbol}.</p>
        ) : (
          <ol className="leaderboard">
            {topSenders.map((sender) => (
              <li key={sender.payer}>
                <span>{shortAddress(sender.payer)}</span>
                <strong>{formatAmount(sender.total, token.decimals, token.symbol)}</strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
