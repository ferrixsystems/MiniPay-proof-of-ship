import { useMemo, useState } from 'react'
import { createPublicClient, createWalletClient, custom, http, parseUnits } from 'viem'
import { celo } from 'viem/chains'
import { APP_NAME, CELO_CHAIN_ID_HEX, CONTRACT_ADDRESS, TOKENS } from './lib/config'

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

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function randomReference(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}

function getWalletName(ethereum: any): string {
  if (!ethereum) return 'Not detected'
  if (ethereum.isMiniPay) return 'MiniPay'
  if (ethereum.isRabby) return 'Rabby'
  if (ethereum.isMetaMask) return 'MetaMask'
  return 'Injected wallet'
}

function getNetworkLabel(chainId: string): string {
  if (chainId?.toLowerCase() === CELO_CHAIN_ID_HEX) return 'Celo Mainnet'
  return `Chain ${chainId}`
}

function toUserError(error: any): string {
  if (error?.code === 4001) return 'Request was canceled in your wallet.'
  const raw = String(error?.shortMessage || error?.message || '')
  if (/user rejected|denied/i.test(raw)) return 'Request was canceled in your wallet.'
  if (/insufficient funds/i.test(raw)) return 'Insufficient balance to pay gas or token amount.'
  return raw || 'Payment failed.'
}

export function App() {
  const [account, setAccount] = useState<string>('')
  const [amount, setAmount] = useState<string>('1')
  const [tokenSymbol, setTokenSymbol] = useState<string>('USDC')
  const [note, setNote] = useState<string>('Top up via Pix2Celo')
  const [walletName, setWalletName] = useState<string>('Not connected')
  const [networkName, setNetworkName] = useState<string>('Unknown')
  const [txHash, setTxHash] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [connecting, setConnecting] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const token = useMemo(() => TOKENS.find((t) => t.symbol === tokenSymbol), [tokenSymbol])
  const txUrl = txHash ? `https://celoscan.io/tx/${txHash}` : ''
  const connected = Boolean(account)

  async function connect() {
    setError('')
    if (!window.ethereum) {
      setError('MiniPay or browser wallet extension was not found.')
      return
    }

    setConnecting(true)
    try {
      const providerName = getWalletName(window.ethereum)
      setWalletName(providerName)

      let chainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (chainId !== CELO_CHAIN_ID_HEX) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CELO_CHAIN_ID_HEX }]
        })
        chainId = CELO_CHAIN_ID_HEX
      }

      const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(addr)
      setNetworkName(getNetworkLabel(chainId))
    } catch (e: any) {
      setError(toUserError(e))
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
      const walletClient = createWalletClient({
        chain: celo,
        transport: custom(window.ethereum)
      })

      const publicClient = createPublicClient({
        chain: celo,
        transport: http()
      })

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

  return (
    <main className="container">
      <section className="card">
        <div className="topbar">
          <span className="network">Celo Mainnet</span>
          <span className="tag">MiniPay Ready</span>
        </div>

        <h1>{APP_NAME}</h1>
        <p className="subtitle">Stablecoin top-ups and payments in USDC/USDT with an onchain receipt.</p>

        <div className="walletPanel">
          <div className="walletHead">
            <div className="walletIdentity">
              <span className={connected ? 'statusDot online' : 'statusDot offline'} />
              <div>
                <p className="walletTitle">Wallet Session</p>
                <strong className="walletAddress">{connected ? shortAddress(account) : 'Not connected'}</strong>
              </div>
            </div>
            <button onClick={connect} className="connectBtn" disabled={connecting}>
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

        <label>Amount ({tokenSymbol})</label>
        <div className="row">
          {QUICK_AMOUNTS.map((v) => (
            <button key={v} className={amount === v ? 'chip selected' : 'chip'} onClick={() => setAmount(v)}>
              {v} {tokenSymbol}
            </button>
          ))}
        </div>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/,/g, '.'))}
          placeholder={`Enter ${tokenSymbol} amount`}
        />

        <label>Token</label>
        <select value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)}>
          {TOKENS.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol}
            </option>
          ))}
        </select>

        <label>Description</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />

        <button disabled={!account || loading} onClick={pay} className="primary">
          {loading ? 'Processing transaction...' : `Pay ${amount || '0'} ${tokenSymbol}`}
        </button>

        {txHash && (
          <div className="txCard">
            <p className="txTitle">Payment confirmed</p>
            <p className="txHash">{txHash}</p>
            <div className="txActions">
              <button className="secondary" onClick={copyTxHash}>{copied ? 'Copied' : 'Copy hash'}</button>
              <a className="secondary link" href={txUrl} target="_blank" rel="noreferrer">View on CeloScan</a>
            </div>
          </div>
        )}

        {error && <p className="err">{error}</p>}
      </section>
    </main>
  )
}
