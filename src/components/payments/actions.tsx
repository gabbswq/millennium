'use client'

import { useState } from 'react'
import { CreditCard, ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { checkoutUrl } from '@/lib/stripe/guards'
import { trustedStripeUrl } from '@/lib/stripe/kyc'

export function StripeAction({ priceId, enabled, seller = false, fresh = false }: { priceId?: string; enabled: boolean; seller?: boolean; fresh?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [requestId] = useState(() => globalThis.crypto?.randomUUID())
  async function start() {
    setBusy(true); setError('')
    try {
      let key = requestId
      if (!seller && priceId) {
        if (fresh) sessionStorage.removeItem(`millennium.checkout.${priceId}`)
        key = sessionStorage.getItem(`millennium.checkout.${priceId}`) ?? key ?? crypto.randomUUID()
        sessionStorage.setItem(`millennium.checkout.${priceId}`, key)
      }
      const response = await fetch(seller ? '/api/stripe/onboarding' : '/api/checkout', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(seller ? {} : { price_id: priceId, request_id: key }),
        signal: AbortSignal.timeout(25000),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Servico indisponivel.')
      const url = seller ? body.url : body.checkout_url
      if (typeof url !== 'string' || !(seller ? trustedStripeUrl(url) : checkoutUrl(url))) throw new Error('Endereco Stripe invalido.')
      window.location.assign(url)
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'Resposta nao confirmada. Consulte o pedido antes de tentar novamente.')
      setBusy(false)
    }
  }
  return <div><button className="payment-primary" type="button" onClick={start} disabled={!enabled || busy}>
    {busy ? <LoaderCircle size={18} className="payment-spin" /> : seller ? <ExternalLink size={18} /> : <CreditCard size={18} />}
    {busy ? 'Aguarde...' : seller ? 'Continuar cadastro na Stripe' : 'Abrir Checkout'}
  </button>{error && <p className="payment-error" role="alert">{error}</p>}</div>
}

export function RefreshStatus() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return <button type="button" className="payment-secondary" disabled={busy} onClick={() => {
    setBusy(true); router.refresh(); setTimeout(() => setBusy(false), 3000)
  }}><RefreshCw size={16} />{busy ? 'Atualizando...' : 'Atualizar status'}</button>
}
