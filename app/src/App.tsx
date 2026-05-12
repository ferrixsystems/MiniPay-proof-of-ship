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

export function App() {
  const [account, setAccount] = useState<string>('')
  const [value, setValue] = useState<string>('10')
  const [tokenSymbol, setTokenSymbol] = useState<string>('USDC')
  const [note, setNote] = useState<string>('Recarga Pix2Celo')
  const [txHash, setTxHash] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const token = useMemo(() => TOKENS.find((t) => t.symbol === tokenSymbol), [tokenSymbol])

  async function connect() {
    setError('')
    if (!window.ethereum) {
      setError('MiniPay/Wallet não detectada.')
      return
    }

    const chainId = await window.ethereum.request({ method: 'eth_chainId' })
    if (chainId !== CELO_CHAIN_ID_HEX) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CELO_CHAIN_ID_HEX }]
      })
    }

    const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' })
    setAccount(addr)
  }

  async function pay() {
    setError('')
    setTxHash('')

    if (!window.ethereum || !account) return
    if (!token || !token.address || !CONTRACT_ADDRESS) {
      setError('Configure VITE_USDC_ADDRESS/VITE_USDT_ADDRESS e VITE_CONTRACT_ADDRESS.')
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
      const reference = (`0x${crypto.randomUUID().replace(/-/g, '').slice(0, 64)}`).padEnd(66, '0') as `0x${string}`

      const approveHash = await walletClient.writeContract({
        account: account as `0x`,
        address: token.address as `0x`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS as `0x${string}`, amount]
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      const payHash = await walletClient.writeContract({
        account: account as `0x`,
        address: CONTRACT_ADDRESS as `0x`,
        abi: VAULT_ABI,
        functionName: 'pay',
        args: [token.address as `0x${string}`, amount, reference, note]
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
        <h1>{APP_NAME}</h1>
        <p>Recarga e pagamento estável em USDC/USDT com comprovante onchain na Celo.</p>

        <button onClick={connect} className="primary">{account ? `Conectado: ${account.slice(0, 6)}...${account.slice(-4)}` : 'Conectar MiniPay'}</button>

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
            <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
          ))}
        </select>

        <label>Descrição</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />

        <button disabled={!account || loading} onClick={pay} className="primary">
          {loading ? 'Processando...' : 'Pagar Agora'}
        </button>

        {txHash && <p className="ok">Tx: {txHash}</p>}
        {error && <p className="err">{error}</p>}
      </section>
    </main>
  )
}
