import { useEffect, useMemo, useState } from 'react'
import './style.css'

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed'

type Payment = {
  payment_id: string
  status: PaymentStatus
  amount: number
  currency: string
  customer_id: string
  error?: string | null
  created_at: string
  updated_at: string
}

const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE_URL?.toString().trim() || '/api'

const formatCents = (amount: number, currency: string) => {
  const value = amount / 100
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

const isTerminalStatus = (status: PaymentStatus) =>
  status === 'succeeded' || status === 'failed'

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE)
  const [amount, setAmount] = useState('1250')
  const [currency, setCurrency] = useState('USD')
  const [customerId, setCustomerId] = useState('customer_123')
  const [idempotencyKey, setIdempotencyKey] = useState('')

  const [payment, setPayment] = useState<Payment | null>(null)
  const [lookupId, setLookupId] = useState('')
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<'ok' | 'error' | 'unknown'>('unknown')

  const api = useMemo(() => apiBaseUrl.replace(/\/+$/, ''), [apiBaseUrl])

  useEffect(() => {
    let cancelled = false
    const checkHealth = async () => {
      try {
        const response = await fetch(`${api}/health`)
        if (!response.ok) throw new Error('Health check failed')
        if (!cancelled) setHealth('ok')
      } catch {
        if (!cancelled) setHealth('error')
      }
    }
    checkHealth()
    return () => {
      cancelled = true
    }
  }, [api])

  useEffect(() => {
    if (!payment?.payment_id || !polling) return
    if (isTerminalStatus(payment.status)) {
      setPolling(false)
      return
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`${api}/payments/${payment.payment_id}`)
        if (!response.ok) return
        const data = (await response.json()) as Payment
        setPayment(data)
        if (isTerminalStatus(data.status)) {
          setPolling(false)
        }
      } catch {
        // ignore polling errors
      }
    }, 2000)

    return () => window.clearInterval(interval)
  }, [api, payment, polling])

  const createPayment = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    setPolling(false)

    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount in cents.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${api}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify({
          amount: Math.round(parsedAmount),
          currency: currency.toUpperCase(),
          customer_id: customerId.trim(),
        }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Unable to create payment.')
      }

      const data = (await response.json()) as Payment
      setPayment(data)
      setLookupId(data.payment_id)
      setPolling(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchPayment = async () => {
    if (!lookupId.trim()) return
    setError(null)
    setLoading(true)
    setPolling(false)
    try {
      const response = await fetch(`${api}/payments/${lookupId.trim()}`)
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Payment not found.')
      }
      const data = (await response.json()) as Payment
      setPayment(data)
      if (!isTerminalStatus(data.status)) {
        setPolling(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch payment.')
    } finally {
      setLoading(false)
    }
  }

  const statusLabel = payment?.status ?? 'none'

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Payment Receipt Processor</p>
          <h1>Payment processing dashboard</h1>
          <p className="subhead">
            Create a payment, track its status, and verify the backend health.
          </p>
        </div>
        <div className={`health health-${health}`}>
          <span className="dot" />
          {health === 'unknown'
            ? 'Checking health...'
            : health === 'ok'
              ? 'Backend healthy'
              : 'Backend unavailable'}
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>API connection</h2>
          <p>Point the frontend at your FastAPI backend.</p>
        </div>
        <div className="panel-body">
          <label className="field">
            <span>API Base URL</span>
            <input
              type="url"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              placeholder="/api or http://localhost:8000"
            />
          </label>
          <p className="hint">
            Use <code>VITE_API_BASE_URL</code> for a full URL, or set
            <code>VITE_API_PROXY_TARGET</code> to proxy <code>/api</code> in dev.
          </p>
        </div>
      </section>

      <div className="grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Create payment</h2>
            <p>Send a POST to /payments.</p>
          </div>
          <form className="panel-body" onSubmit={createPayment}>
            <label className="field">
              <span>Amount (cents)</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Currency</span>
              <input
                type="text"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                maxLength={3}
                required
              />
            </label>
            <label className="field">
              <span>Customer ID</span>
              <input
                type="text"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Idempotency Key (optional)</span>
              <input
                type="text"
                value={idempotencyKey}
                onChange={(event) => setIdempotencyKey(event.target.value)}
                placeholder="reuse this to avoid duplicates"
              />
            </label>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create payment'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Lookup payment</h2>
            <p>Check status using a payment id.</p>
          </div>
          <div className="panel-body">
            <label className="field">
              <span>Payment ID</span>
              <input
                type="text"
                value={lookupId}
                onChange={(event) => setLookupId(event.target.value)}
                placeholder="payment_..."
              />
            </label>
            <div className="row">
              <button className="secondary" onClick={fetchPayment} disabled={loading}>
                {loading ? 'Loading...' : 'Fetch status'}
              </button>
              <button
                className="ghost"
                onClick={() => setPolling((prev) => !prev)}
                disabled={!payment}
                type="button"
              >
                {polling ? 'Stop polling' : 'Start polling'}
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Payment status</h2>
          <p>Live view of the most recent payment.</p>
        </div>
        <div className="panel-body">
          {error && <p className="error">{error}</p>}
          {payment ? (
            <div className="status-card">
              <div className="status-header">
                <div>
                  <p className="label">Payment ID</p>
                  <p className="value">{payment.payment_id}</p>
                </div>
                <span className={`badge badge-${payment.status}`}>
                  {payment.status}
                </span>
              </div>
              <div className="status-grid">
                <div>
                  <p className="label">Amount</p>
                  <p className="value">
                    {formatCents(payment.amount, payment.currency)}
                  </p>
                </div>
                <div>
                  <p className="label">Customer</p>
                  <p className="value">{payment.customer_id}</p>
                </div>
                <div>
                  <p className="label">Created</p>
                  <p className="value">
                    {new Date(payment.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="label">Updated</p>
                  <p className="value">
                    {new Date(payment.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {payment.error && (
                <div className="error-banner">Error: {payment.error}</div>
              )}
            </div>
          ) : (
            <p className="placeholder">
              No payment loaded. Create a new payment or fetch an existing one.
            </p>
          )}
        </div>
      </section>

      <footer className="footer">
        <p>Status: {statusLabel}</p>
        <p>Polling: {polling ? 'on' : 'off'}</p>
      </footer>
    </div>
  )
}
