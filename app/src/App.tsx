import { useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, custom, http, parseUnits } from 'viem'
import { celo } from 'viem/chains'
import { APP_NAME, CELO_CHAIN_ID_HEX, CONTRACT_ADDRESS, TOKENS } from './lib/config'
import type { ConnectStep, FeedStatus, LivePayment, TokenMeta } from './lib/types'
import { buildPaymentLink, getWalletName, getNetworkLabel, isAddress, randomReference, sanitizeAmount, toUserError } from './lib/utils'
import { ConnectModal } from './components/ConnectModal'
import { LiveBoard } from './components/LiveBoard'
import { PaymentForm } from './components/PaymentForm'
import { PurposeBox } from './components/PurposeBox'
import { TxReceipt } from './components/TxReceipt'
import { WalletPanel } from './components/WalletPanel'

declare global {
  interface Window {
    ethereum?: any
  }
}

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const

const VAULT_ABI = [
  {
    type: 'event',
    name: 'PaymentReceived',
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: true, name: 'paymentRef', type: 'bytes32' },
      { indexed: false, name: 'note', type: 'string' }
    ]
  },
  {
    type: 'function',
    name: 'pay',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'reference', type: 'bytes32' },
      { name: 'note', type: 'string' }
    ],
    outputs: []
  }
] as const

const QUICK_AMOUNTS = ['1', '5', '10', '20']
const AUTO_REFRESH_MS = 8_000
const INITIAL_BLOCK_WINDOW = 20_000n
const SLIDES_PER_PAGE = 4
const SLIDE_MS = 3000

export function App() {
  const [account, setAccount] = useState('')
  const [amount, setAmount] = useState('1')
  const [tokenSymbol, setTokenSymbol] = useState('USDC')
  const [note, setNote] = useState('Top up via Celo Stable Pay')
  const [walletName, setWalletName] = useState('Not connected')
  const [networkName, setNetworkName] = useState('Unknown')
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [requestLoaded, setRequestLoaded] = useState(false)
  const [error, setError] = useState('')
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [connectStep, setConnectStep] = useState<ConnectStep>('select')

  const [livePayments, setLivePayments] = useState<LivePayment[]>([])
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('idle')
  const [feedError, setFeedError] = useState('')
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [clock, setClock] = useState(Date.now())
  const [slideIndex, setSlideIndex] = useState(0)

  const lastScannedBlockRef = useRef<bigint | null>(null)

  const token = useMemo(() => TOKENS.find((t) => t.symbol === tokenSymbol), [tokenSymbol])
  const txUrl = txHash ? `https://celoscan.io/tx/${txHash}` : ''
  const connected = Boolean(account)
  const paymentLink = useMemo(() => buildPaymentLink(amount, tokenSymbol, note), [amount, note, tokenSymbol])
  const paymentLinkReady = Boolean(sanitizeAmount(amount))

  const tokenByAddress = useMemo(() => {
    const map = new Map<string, TokenMeta>()
    TOKENS.forEach((t) => map.set(t.address.toLowerCase(), t))
    return map
  }, [])

  const topSenders = useMemo(() => {
    if (!token?.address) return []
    const selected = token.address.toLowerCase()
    const acc = new Map<string, bigint>()

    for (const payment of livePayments) {
      if (payment.token.toLowerCase() !== selected) continue
      acc.set(payment.payer, (acc.get(payment.payer) || 0n) + payment.amount)
    }

    return Array.from(acc.entries())
      .map(([payer, total]) => ({ payer, total }))
      .sort((a, b) => (a.total > b.total ? -1 : 1))
      .slice(0, 5)
  }, [livePayments, token])

  const pages = useMemo(() => {
    const groups: LivePayment[][] = []
    for (let i = 0; i < livePayments.length; i += SLIDES_PER_PAGE) groups.push(livePayments.slice(i, i + SLIDES_PER_PAGE))
    return groups
  }, [livePayments])

  const pageCount = Math.max(1, pages.length)

  function openConnectModal() {
    setError('')
    setConnectStep('select')
    setConnectModalOpen(true)
  }

  async function connectWallet() {
    setError('')
    if (!window.ethereum) {
      setError('MiniPay or browser wallet extension was not found.')
      return
    }

    setConnecting(true)
    setConnectStep('confirming')
    try {
      setWalletName(getWalletName(window.ethereum))

      let chainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (chainId !== CELO_CHAIN_ID_HEX) {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CELO_CHAIN_ID_HEX }] })
        chainId = CELO_CHAIN_ID_HEX
      }

      const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(addr)
      setNetworkName(getNetworkLabel(chainId))
      setConnectModalOpen(false)
    } catch (e: any) {
      setError(toUserError(e))
    } finally {
      setConnecting(false)
      setConnectStep('select')
    }
  }

  async function copyTxHash() {
    if (!txHash) return
    await navigator.clipboard.writeText(txHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function copyPaymentLink() {
    if (!paymentLinkReady) {
      setError('Enter a valid amount before copying a payment link.')
      return
    }

    setError('')
    await navigator.clipboard.writeText(paymentLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  async function sharePaymentLink() {
    if (!paymentLinkReady) {
      setError('Enter a valid amount before sharing a payment link.')
      return
    }

    try {
      setError('')
      const title = `${APP_NAME} payment request`
      const text = `Pay ${amount} ${tokenSymbol}${note ? ` - ${note}` : ''}`

      if (navigator.share) {
        await navigator.share({ title, text, url: paymentLink })
        return
      }

      await navigator.clipboard.writeText(paymentLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    } catch (e: any) {
      const message = toUserError(e)
      if (/canceled|cancelled/i.test(message)) return
      setError(message)
    }
  }

  function openPaymentLink() {
    if (!paymentLinkReady) {
      setError('Enter a valid amount before opening a payment link.')
      return
    }

    window.open(paymentLink, '_blank', 'noopener,noreferrer')
  }

  async function pay() {
    setError('')
    setTxHash('')

    if (!window.ethereum || !account) return
    if (!token || !token.address || !CONTRACT_ADDRESS) {
      setError('Set VITE_USDC_ADDRESS, VITE_USDT_ADDRESS and VITE_CONTRACT_ADDRESS.')
      return
    }
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount.')
      return
    }

    setLoading(true)
    try {
      const walletClient = createWalletClient({ chain: celo, transport: custom(window.ethereum) })
      const publicClient = createPublicClient({ chain: celo, transport: http() })

      const parsedAmount = parseUnits(amount, token.decimals)
      const reference = randomReference()
      const accountAddress = account as `0x${string}`
      const tokenAddress = token.address as `0x${string}`
      const contractAddress = CONTRACT_ADDRESS as `0x${string}`

      const approveHash = await walletClient.writeContract({
        account: accountAddress,
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contractAddress, parsedAmount]
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      const payHash = await walletClient.writeContract({
        account: accountAddress,
        address: contractAddress,
        abi: VAULT_ABI,
        functionName: 'pay',
        args: [tokenAddress, parsedAmount, reference, note]
      })
      await publicClient.waitForTransactionReceipt({ hash: payHash })
      setTxHash(payHash)
    } catch (e: any) {
      setError(toUserError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlAmount = sanitizeAmount(params.get('amount') || '')
    const urlToken = (params.get('token') || '').toUpperCase()
    const urlNote = params.get('note')
    const urlView = params.get('view')

    if (urlAmount) setAmount(urlAmount)
    if (TOKENS.some((t) => t.symbol === urlToken)) setTokenSymbol(urlToken)
    if (urlNote) setNote(urlNote.slice(0, 120))
    if (urlAmount || TOKENS.some((t) => t.symbol === urlToken) || urlNote || urlView === 'request') setRequestLoaded(true)
  }, [])

  useEffect(() => {
    if (!requestLoaded) return
    const id = setTimeout(() => {
      const target = document.getElementById('pay-request-btn')
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => clearTimeout(id)
  }, [requestLoaded])

  useEffect(() => {
    if (slideIndex > pageCount - 1) setSlideIndex(0)
  }, [pageCount, slideIndex])

  useEffect(() => {
    if (pageCount <= 1) return
    const id = setInterval(() => setSlideIndex((prev) => (prev + 1) % pageCount), SLIDE_MS)
    return () => clearInterval(id)
  }, [pageCount])

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isAddress(CONTRACT_ADDRESS)) {
      setFeedStatus('idle')
      setFeedError('Set VITE_CONTRACT_ADDRESS to enable the live feed.')
      return
    }

    let active = true
    const publicClient = createPublicClient({ chain: celo, transport: http() })
    const contractAddress = CONTRACT_ADDRESS as `0x${string}`

    async function mapLogs(logs: any[]): Promise<LivePayment[]> {
      const uniqueBlocks = Array.from(
        new Set(
          logs
            .map((log) => log.blockNumber as bigint | null)
            .filter((blockNumber): blockNumber is bigint => blockNumber !== null)
            .map((blockNumber) => blockNumber.toString())
        )
      ).map((n) => BigInt(n))

      const blockTimeMap = new Map<bigint, number>()
      await Promise.all(
        uniqueBlocks.map(async (blockNumber) => {
          const block = await publicClient.getBlock({ blockNumber })
          blockTimeMap.set(blockNumber, Number(block.timestamp) * 1000)
        })
      )

      return logs
        .map((log) => {
          const args = log.args as { payer?: `0x${string}`; token?: `0x${string}`; amount?: bigint; note?: string }
          if (!args.payer || !args.token || typeof args.amount !== 'bigint') return null
          if (!log.transactionHash || log.blockNumber === null) return null

          return {
            txHash: log.transactionHash,
            logIndex: Number(log.logIndex ?? 0),
            blockNumber: log.blockNumber,
            blockTimestampMs: blockTimeMap.get(log.blockNumber) || Date.now(),
            payer: args.payer,
            token: args.token,
            amount: args.amount,
            note: args.note || ''
          } satisfies LivePayment
        })
        .filter((value): value is LivePayment => value !== null)
    }

    async function fetchInitial() {
      try {
        setFeedStatus('syncing')
        setFeedError('')

        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > INITIAL_BLOCK_WINDOW ? latestBlock - INITIAL_BLOCK_WINDOW : 0n

        const logs = await publicClient.getLogs({
          address: contractAddress,
          event: VAULT_ABI[0],
          fromBlock,
          toBlock: latestBlock
        })

        const mapped = await mapLogs(logs)
        mapped.sort((a, b) => (a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1))

        if (!active) return
        setLivePayments(mapped.slice(0, 40))
        setLastRefreshAt(Date.now())
        setFeedStatus('live')
        lastScannedBlockRef.current = latestBlock
      } catch (e: any) {
        if (!active) return
        setFeedStatus('error')
        setFeedError(toUserError(e))
      }
    }

    async function pollNew() {
      try {
        const latestBlock = await publicClient.getBlockNumber()
        const lastScanned = lastScannedBlockRef.current

        if (lastScanned === null || latestBlock <= lastScanned) {
          lastScannedBlockRef.current = latestBlock
          setLastRefreshAt(Date.now())
          return
        }

        const logs = await publicClient.getLogs({
          address: contractAddress,
          event: VAULT_ABI[0],
          fromBlock: lastScanned + 1n,
          toBlock: latestBlock
        })

        const mapped = await mapLogs(logs)
        if (!active) return

        if (mapped.length > 0) {
          setLivePayments((previous) => {
            const merged = [...mapped, ...previous]
            const dedupe = new Map<string, LivePayment>()
            for (const item of merged) dedupe.set(`${item.txHash}:${item.logIndex}`, item)
            const unique = Array.from(dedupe.values())
            unique.sort((a, b) => (a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1))
            return unique.slice(0, 40)
          })
        }

        setFeedStatus('live')
        setLastRefreshAt(Date.now())
        lastScannedBlockRef.current = latestBlock
      } catch (e: any) {
        if (!active) return
        setFeedStatus('error')
        setFeedError(toUserError(e))
      }
    }

    fetchInitial()
    const interval = setInterval(pollNew, AUTO_REFRESH_MS)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return (
    <main className="container">
      <div className="appFrame">
        <section className="checkoutCard">
          <div className="topbar">
            <span className="network">Celo Mainnet</span>
            <span className="tag">MiniPay Ready</span>
          </div>

          <div className="brandLine">
            <img src="/image.png" alt="" className="brandImage" />
            <div>
              <h1>{APP_NAME}</h1>
              <p className="subtitle">Stablecoin checkout for USDC/USDT payments with public onchain receipts.</p>
            </div>
          </div>

          <PurposeBox />

          <div className="checkoutStack">
            {requestLoaded && (
              <div className="requestBanner">
                <span>Payment request loaded from shared link</span>
                <strong>{amount} {tokenSymbol}</strong>
              </div>
            )}

            <WalletPanel
              connected={connected}
              account={account}
              walletName={walletName}
              networkName={networkName}
              connecting={connecting}
              onConnectClick={openConnectModal}
            />

            <PaymentForm
              tokenSymbol={tokenSymbol}
              tokens={TOKENS}
              amount={amount}
              note={note}
              quickAmounts={QUICK_AMOUNTS}
              loading={loading}
              connected={connected}
              paymentLink={paymentLink}
              paymentLinkReady={paymentLinkReady}
              linkCopied={linkCopied}
              requestLoaded={requestLoaded}
              onAmountSelect={setAmount}
              onAmountChange={setAmount}
              onTokenChange={setTokenSymbol}
              onNoteChange={setNote}
              onPay={pay}
              onCopyPaymentLink={copyPaymentLink}
              onSharePaymentLink={sharePaymentLink}
              onOpenPaymentLink={openPaymentLink}
            />

            <TxReceipt txHash={txHash} txUrl={txUrl} copied={copied} onCopy={copyTxHash} />

            {error && <p className="err">{error}</p>}
          </div>
        </section>

        <LiveBoard
          livePayments={livePayments}
          pages={pages}
          pageCount={pageCount}
          slideIndex={slideIndex}
          setSlideIndex={setSlideIndex}
          feedStatus={feedStatus}
          feedError={feedError}
          autoRefreshSeconds={AUTO_REFRESH_MS / 1000}
          lastRefreshAt={lastRefreshAt}
          clock={clock}
          tokenByAddress={tokenByAddress}
          tokenSymbol={tokenSymbol}
          topSenders={topSenders}
          token={token}
        />
      </div>

      <ConnectModal
        open={connectModalOpen}
        connecting={connecting}
        step={connectStep}
        onClose={() => setConnectModalOpen(false)}
        onConnectChoice={connectWallet}
      />
    </main>
  )
}
