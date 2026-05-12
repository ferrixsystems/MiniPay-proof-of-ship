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

const BRL_VALUES = ['10', '20', '50']

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function randomReference(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}

export function App() {
  const [account, setAccount] = useState<string>('')
  const [value, setValue] = useState<string>('10')
  const [tokenSymbol, setTokenSymbol] = useState<string>('USDC')
  const [note, setNote] = useState<string>('Recarga Pix2Celo')
  const [txHash, setTxHash] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const token = useMemo(() => TOKENS.find((t) => t.symbol === tokenSymbol), [tokenSymbol])
  const txUrl = txHash ? `https://celoscan.io/tx/${txHash}` : ''

  async function connect() {
    setError('')
    if (!window.ethereum) {
      setError('MiniPay/Wallet nao detectada.')
      return
    }

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (chainId !== CELO_CHAIN_ID_HEX) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CELO_CHAIN_ID_HEX }]
        })
      }

      const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(addr)
    } catch (e: any) {
      setError(e?.message || 'Falha ao conectar carteira.')
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
      setError('Configure VITE_USDC_ADDRESS, VITE_USDT_ADDRESS e VITE_CONTRACT_ADDRESS.')
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

      const amount = parseUnits(value, token.decimals)
      const reference = randomReference()
      const accountAddress = account as `0x${string}`
      const tokenAddress = token.address as `0x${string}`
      const contractAddress = CONTRACT_ADDRESS as `0x${string}`

      const approveHash = await walletClient.writeContract({
        account: accountAddress,
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contractAddress, amount]
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      const payHash = await walletClient.writeContract({
        account: accountAddress,
        address: contractAddress,
        abi: VAULT_ABI,
        functionName: 'pay',
        args: [tokenAddress, amount, reference, note]
      })

      await publicClient.waitForTransactionReceipt({ hash: payHash })
      setTxHash(payHash)
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Falha ao enviar pagamento.')
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
        <p className="subtitle">Recarga e pagamento estavel em USDC/USDT com comprovante onchain.</p>

        <button onClick={connect} className="primary ghost">
          {account ? `Conectado: ${shortAddress(account)}` : 'Conectar MiniPay'}
        </button>

        <label>Valor (BRL)</label>
        <div className="row">
          {BRL_VALUES.map((v) => (
            <button key={v} className={value === v ? 'chip selected' : 'chip'} onClick={() => setValue(v)}>
              R$ {v}
            </button>
          ))}
        </div>

        <label>Token</label>
        <select value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)}>
          {TOKENS.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol}
            </option>
          ))}
        </select>

        <label>Descricao</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />

        <button disabled={!account || loading} onClick={pay} className="primary">
          {loading ? 'Processando transacao...' : 'Pagar Agora'}
        </button>

        {txHash && (
          <div className="txCard">
            <p className="txTitle">Pagamento confirmado</p>
            <p className="txHash">{txHash}</p>
            <div className="txActions">
              <button className="secondary" onClick={copyTxHash}>{copied ? 'Copiado' : 'Copiar hash'}</button>
              <a className="secondary link" href={txUrl} target="_blank" rel="noreferrer">Ver no CeloScan</a>
            </div>
          </div>
        )}

        {error && <p className="err">{error}</p>}
      </section>
    </main>
  )
}
