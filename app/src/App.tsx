import { useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, custom, fallback, http, parseUnits } from 'viem'
import { celo } from 'viem/chains'
import { APP_NAME, CELO_CHAIN_ID_HEX, CELO_RPC_URL, CONTRACT_ADDRESS, TOKENS } from './lib/config'
import type { ConnectStep, FeedStatus, LivePayment, TokenMeta } from './lib/types'
import { buildPaymentLink, getWalletName, getNetworkLabel, isAddress, pickWalletProvider, randomReference, sanitizeAmount, toUserError } from './lib/utils'
import type { WalletTarget } from './lib/utils'
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
const INITIAL_BLOCK_WINDOW = BigInt(import.meta.env.VITE_FEED_INITIAL_BLOCK_WINDOW || '300000')
const LOG_CHUNK_SIZE = 2_000n
const SLIDES_PER_PAGE = 4
const SLIDE_MS = 3000
const CELO_CHAIN_ID_DEC = 42220
const WALLETCONNECT_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '').trim()
const DEFAULT_CELO_RPCS = ['https://forno.celo.org', 'https://rpc.ankr.com/celo', 'https://1rpc.io/celo']
const WALLETCONNECT_TIMEOUT_MS = 20_000

export function App() {
  const [account, setAccount] = useState('')
  const [amount, setAmount] = useState('1')
  const [tokenSymbol, setTokenSymbol] = useState('USDC')
  const [note, setNote] = useState('Top up via Celo Stable Pay')
  const [walletName, setWalletName] = useState('Not connected')
  const [networkName, setNetworkName] = useState('Unknown')
  const [activeProvider, setActiveProvider] = useState<any>(null)
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [requestLoaded, setRequestLoaded] = useState(false)
  const [error, setError] = useState('')
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [connectStep, setConnectStep] = useState<ConnectStep>('select')
  const [walletConnectUri, setWalletConnectUri] = useState('')

  const [livePayments, setLivePayments] = useState<LivePayment[]>([])
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('idle')
  const [feedError, setFeedError] = useState('')
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [clock, setClock] = useState(Date.now())
  const [slideIndex, setSlideIndex] = useState(0)

  const lastScannedBlockRef = useRef<bigint | null>(null)
  const walletConnectProviderRef = useRef<any>(null)
  const walletConnectInitRef = useRef<Promise<any> | null>(null)

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

  const rpcEndpoints = useMemo(() => {
    const endpoints = CELO_RPC_URL ? [CELO_RPC_URL, ...DEFAULT_CELO_RPCS] : DEFAULT_CELO_RPCS
    return Array.from(new Set(endpoints))
  }, [])

  const rpcClients = useMemo(
    () => rpcEndpoints.map((url) => createPublicClient({ chain: celo, transport: http(url) })),
    [rpcEndpoints]
  )

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

  function createCeloClient() {
    const endpoints = CELO_RPC_URL ? [CELO_RPC_URL, ...DEFAULT_CELO_RPCS] : DEFAULT_CELO_RPCS
    const unique = Array.from(new Set(endpoints))
    return createPublicClient({
      chain: celo,
      transport: fallback(unique.map((url) => http(url)))
    })
  }

  function openConnectModal() {
    setError('')
    setConnectStep('select')
    setWalletConnectUri('')
    setConnectModalOpen(true)
  }

  function closeConnectModal() {
    setConnectModalOpen(false)
    setConnectStep('select')
    setWalletConnectUri('')
  }

  async function initWalletConnectProvider() {
    if (!WALLETCONNECT_PROJECT_ID) {
      throw new Error('Set VITE_WALLETCONNECT_PROJECT_ID to enable WalletConnect QR.')
    }

    if (walletConnectProviderRef.current) return walletConnectProviderRef.current
    if (walletConnectInitRef.current) return walletConnectInitRef.current

    walletConnectInitRef.current = (async () => {
      const { default: EthereumProvider } = await import('@walletconnect/ethereum-provider')
      const provider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [CELO_CHAIN_ID_DEC],
        optionalChains: [CELO_CHAIN_ID_DEC],
        showQrModal: true,
        methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
        optionalMethods: ['wallet_switchEthereumChain', 'wallet_addEthereumChain'],
        optionalEvents: ['chainChanged', 'accountsChanged', 'disconnect'],
        metadata: {
          name: APP_NAME,
          description: 'Celo stablecoin checkout with onchain receipts',
          url: window.location.origin,
          icons: [`${window.location.origin}/image.png`]
        }
      })

      // Keep latest URI so we can always render QR in-app if popup/modal fails to appear.
      provider.on('display_uri', (uri: string) => {
        setWalletConnectUri(uri)
        setConnectStep('confirming')
      })

      walletConnectProviderRef.current = provider
      return provider
    })()

    try {
      return await walletConnectInitRef.current
    } finally {
      walletConnectInitRef.current = null
    }
  }

  async function connectWallet(target: WalletTarget) {
    setError('')
    if (target !== 'walletconnect' && !window.ethereum) {
      setError('MiniPay or browser wallet extension was not found.')
      return
    }

    setConnecting(true)
    setConnectStep('confirming')
    try {
      let provider: any
      if (target === 'walletconnect') {
        provider = await initWalletConnectProvider()
        setWalletConnectUri('')
        await Promise.race([
          provider.enable(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('WalletConnect QR did not initialize. Check your Project ID and internet.')), WALLETCONNECT_TIMEOUT_MS)
          )
        ])
      } else {
        provider = pickWalletProvider(window.ethereum, target)
        if (!provider) {
          setError(
            target === 'minipay'
              ? 'MiniPay provider not found. Open this app inside MiniPay or use WalletConnect.'
              : 'No compatible browser wallet found.'
          )
          return
        }
      }

      setWalletName(target === 'walletconnect' ? 'WalletConnect' : getWalletName(provider))

      let chainId = await provider.request({ method: 'eth_chainId' })
      if (chainId !== CELO_CHAIN_ID_HEX) {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CELO_CHAIN_ID_HEX }] })
        chainId = CELO_CHAIN_ID_HEX
      }

      const [addr] = await provider.request({ method: 'eth_requestAccounts' })
      setAccount(addr)
      setNetworkName(getNetworkLabel(chainId))
      setActiveProvider(provider)
      closeConnectModal()
    } catch (e: any) {
      setError(toUserError(e))
      setConnectStep('select')
      setWalletConnectUri('')
    } finally {
      setConnecting(false)
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

    const provider = activeProvider || window.ethereum
    if (!provider || !account) return
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
      const walletClient = createWalletClient({ chain: celo, transport: custom(provider) })
      const publicClient = createCeloClient()

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
    const contractAddress = CONTRACT_ADDRESS as `0x${string}`
    let rpcCursor = 0

    async function withRpcFallback<T>(operation: (client: any) => Promise<T>) {
      let lastError: unknown

      for (let i = 0; i < rpcClients.length; i++) {
        const idx = (rpcCursor + i) % rpcClients.length
        const client = rpcClients[idx]
        try {
          const result = await operation(client)
          rpcCursor = idx
          return result
        } catch (error) {
          lastError = error
        }
      }

      throw lastError || new Error('All RPC endpoints failed.')
    }

    async function fetchLogsInChunks(fromBlock: bigint, toBlock: bigint) {
      const chunks: any[] = []
      let cursor = fromBlock

      while (cursor <= toBlock) {
        const end = cursor + LOG_CHUNK_SIZE - 1n > toBlock ? toBlock : cursor + LOG_CHUNK_SIZE - 1n
        const logs = await withRpcFallback<any[]>((client) =>
          client.getLogs({
            address: contractAddress,
            event: VAULT_ABI[0],
            fromBlock: cursor,
            toBlock: end
          })
        )
        chunks.push(...logs)
        cursor = end + 1n
      }

      return chunks
    }

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
          const block = await withRpcFallback<any>((client) => client.getBlock({ blockNumber }))
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

        const latestBlock = await withRpcFallback<bigint>((client) => client.getBlockNumber())
        const fromBlock = latestBlock > INITIAL_BLOCK_WINDOW ? latestBlock - INITIAL_BLOCK_WINDOW : 0n

        const logs = await fetchLogsInChunks(fromBlock, latestBlock)

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
        const latestBlock = await withRpcFallback<bigint>((client) => client.getBlockNumber())
        const lastScanned = lastScannedBlockRef.current

        if (lastScanned === null || latestBlock <= lastScanned) {
          lastScannedBlockRef.current = latestBlock
          setLastRefreshAt(Date.now())
          return
        }

        const logs = await fetchLogsInChunks(lastScanned + 1n, latestBlock)

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
  }, [rpcClients])

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
        walletConnectUri={walletConnectUri}
        onClose={closeConnectModal}
        onConnectChoice={connectWallet}
      />
    </main>
  )
}
