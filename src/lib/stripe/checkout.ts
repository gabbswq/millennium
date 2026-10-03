import { checkoutUrl } from './guards'
import { OnboardingError } from './onboarding'

export interface CheckoutRecord {
  id: string; user_id: string; price_id: string; request_id: string
  stripe_price_id: string; amount_cents: number; currency: string
  creation_state: 'RESERVED' | 'CREATING' | 'UNCERTAIN' | 'BOUND'
  stripe_session_id: string | null; checkout_url: string | null; expires_at: number | null
  payment_state: 'pending' | 'paid' | 'expired' | 'failed'
}
export interface CheckoutStore {
  reserve(): Promise<CheckoutRecord>
  claim(record: CheckoutRecord): Promise<CheckoutRecord | null>
  bind(record: CheckoutRecord, session: CheckoutSession): Promise<void>
  uncertain(record: CheckoutRecord): Promise<void>
}
export interface CheckoutSession {
  id: string; url: string | null; livemode: boolean; expires_at: number
  client_reference_id: string | null; metadata: Record<string, string> | null
}
export interface CheckoutProvider {
  create(record: CheckoutRecord): Promise<CheckoutSession>
}

export async function beginCheckout(store: CheckoutStore, provider: CheckoutProvider, now = Date.now() / 1000) {
  let record = await store.reserve()
  if (record.payment_state !== 'pending') throw new OnboardingError(409, 'Este pedido ja foi encerrado.')
  if (record.creation_state !== 'BOUND') {
    if (record.creation_state !== 'RESERVED') throw new OnboardingError(409, 'Pedido em andamento ou incerto. Nao repetir a cobranca.')
    const claimed = await store.claim(record)
    if (!claimed || claimed.id !== record.id || claimed.user_id !== record.user_id || claimed.request_id !== record.request_id || claimed.creation_state !== 'CREATING') {
      throw new OnboardingError(409, 'Este pedido ja esta em processamento.')
    }
    record = claimed
    try {
      const session = await provider.create(record)
      if (session.livemode !== false || !/^cs_test_[A-Za-z0-9]+$/.test(session.id) || !session.url || !checkoutUrl(session.url) ||
          !Number.isSafeInteger(session.expires_at) || session.expires_at <= now || session.client_reference_id !== record.user_id ||
          session.metadata?.millennium_checkout_id !== record.id) throw new Error('Invalid provider session')
      await store.bind(record, session)
      record = { ...record, creation_state: 'BOUND', stripe_session_id: session.id, checkout_url: session.url, expires_at: session.expires_at }
    } catch {
      await store.uncertain(record).catch(() => {})
      throw new OnboardingError(503, 'Resultado do pedido nao confirmado. Aguarde conciliacao antes de tentar novamente.')
    }
  }
  if (!record.checkout_url || !checkoutUrl(record.checkout_url) || !record.expires_at || record.expires_at <= now) {
    throw new OnboardingError(409, 'Checkout expirado ou indisponivel.')
  }
  return record.checkout_url
}

export interface PaymentFacts {
  id: string; livemode?: boolean; client_reference_id?: string | null; mode?: string
  metadata?: Record<string, string> | null; payment_status?: string
  amount_total?: number | null; currency?: string | null
}
export function paymentDisposition(type: string, session: PaymentFacts): 'pending' | 'paid' | 'expired' | 'failed' {
  if (session.livemode !== false || session.mode !== 'payment' || !/^cs_test_[A-Za-z0-9]+$/.test(session.id) ||
      !session.client_reference_id || !session.metadata?.millennium_checkout_id ||
      !Number.isSafeInteger(session.amount_total) || (session.amount_total ?? 0) <= 0 || session.currency !== 'brl') {
    throw new OnboardingError(400, 'Evento de pagamento inconsistente.')
  }
  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    if (session.payment_status === 'paid') return 'paid'
    if (type === 'checkout.session.completed' && session.payment_status === 'unpaid') return 'pending'
  }
  if (type === 'checkout.session.expired' && session.payment_status === 'unpaid') return 'expired'
  if (type === 'checkout.session.async_payment_failed' && session.payment_status === 'unpaid') return 'failed'
  throw new OnboardingError(400, 'Estado do pagamento inconsistente.')
}
