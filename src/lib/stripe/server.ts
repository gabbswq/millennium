import 'server-only'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateKyc, verifiedIdentity, type KycResult } from './kyc'
import { OnboardingError, type ConnectionStore } from './onboarding'
import { appOrigin, requestBudget } from './guards'
import type { CheckoutStore, CheckoutProvider } from './checkout'
import { isStripeTestSecretKey } from './keys'

export function authConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function stripeConfiguration(feature: 'connect' | 'checkout' = 'connect') {
  const key = process.env.STRIPE_SECRET_KEY
  const configured = process.env[feature === 'connect' ? 'STRIPE_CONNECT_ENABLED' : 'STRIPE_CHECKOUT_ENABLED'] === 'true' &&
    isStripeTestSecretKey(key) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!configured || !key) throw new OnboardingError(503, 'Integracao Stripe indisponivel no momento.')
  return { stripe: new Stripe(key, { timeout: 10000, maxNetworkRetries: 0 }), origin: appOrigin() }
}

export async function authenticatedUser() {
  if (!authConfigured()) throw new OnboardingError(503, 'Autenticacao indisponivel no momento.')
  requestBudget.take('authentication', 120)
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new OnboardingError(401, 'Entre na sua conta para continuar.')
  requestBudget.take(`identity:${user.id}`, 30)
  return { user, supabase }
}

export async function accountAccess() {
  const context = await authenticatedUser()
  if (!verifiedIdentity(context.user)) return { ...context, kyc: { state: 'pending', pendingCount: 0, reviewingCount: 0 } as KycResult, reason: 'email', connection: null }
  let configuration: ReturnType<typeof stripeConfiguration>
  try { configuration = stripeConfiguration() }
  catch { return { ...context, kyc: { state: 'blocked', pendingCount: 0, reviewingCount: 0 } as KycResult, reason: 'configuration', connection: null } }
  const { data: connection, error } = await context.supabase.from('stripe_connected_accounts').select('*').eq('user_id', context.user.id).maybeSingle()
  if (error) return { ...context, kyc: { state: 'blocked', pendingCount: 0, reviewingCount: 0 } as KycResult, reason: 'database', connection: null }
  if (!connection || connection.creation_state === 'RESERVED') return { ...context, kyc: { state: 'pending', pendingCount: 0, reviewingCount: 0 } as KycResult, reason: 'onboarding', connection }
  if (connection.livemode !== false || connection.creation_state !== 'BOUND' || !connection.stripe_account_id) {
    return { ...context, kyc: { state: 'blocked', pendingCount: 0, reviewingCount: 0 } as KycResult, reason: 'uncertain', connection }
  }
  try {
    requestBudget.take(`stripe-status:${context.user.id}`, 6)
    const remote = await configuration.stripe.accounts.retrieve(connection.stripe_account_id)
    return { ...context, kyc: evaluateKyc(remote, connection.stripe_account_id), reason: 'provider', connection }
  } catch {
    return { ...context, kyc: { state: 'blocked', pendingCount: 0, reviewingCount: 0 } as KycResult, reason: 'provider-unavailable', connection }
  }
}

export async function onboardingContext() {
  const context = await authenticatedUser()
  if (!verifiedIdentity(context.user)) throw new OnboardingError(403, 'Confirme seu email antes de continuar.')
  const { stripe, origin } = stripeConfiguration()
  const admin = createAdminClient()
  requestBudget.take(`onboarding:${context.user.id}`, 3)
  const store: ConnectionStore = {
    reserve: async () => {
      const { data, error } = await admin.rpc('reserve_stripe_connection', { p_user_id: context.user.id })
      if (error || data?.length !== 1 || data[0].user_id !== context.user.id) throw new OnboardingError(503, 'Cadastro indisponivel no banco de dados.')
      return data[0]
    },
    claim: async () => {
      const { data, error } = await admin.rpc('claim_stripe_connection', { p_user_id: context.user.id })
      if (error) throw new OnboardingError(503, 'Nao foi possivel reservar o cadastro.')
      return data?.[0] ?? null
    },
    bind: async (connection, id) => {
      const { data, error } = await admin.from('stripe_connected_accounts')
        .update({ stripe_account_id: id, creation_state: 'BOUND' })
        .eq('user_id', context.user.id).eq('request_id', connection.request_id).eq('creation_state', 'CREATING')
        .select('user_id')
      if (error || data?.length !== 1) throw new Error('Connection persistence failed')
    },
    uncertain: async connection => {
      const { error } = await admin.from('stripe_connected_accounts').update({ creation_state: 'UNCERTAIN' })
        .eq('user_id', context.user.id).eq('request_id', connection.request_id).eq('creation_state', 'CREATING')
      if (error) throw new Error('Connection uncertainty persistence failed')
    },
  }
  const provider = {
    create: (requestId: string) => stripe.accounts.create({ type: 'express', country: 'BR',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { millennium_request_id: requestId },
    }, { idempotencyKey: `millennium-connect-${requestId}` }),
    link: async (id: string) => (await stripe.accountLinks.create({ account: id, type: 'account_onboarding',
      collection_options: { fields: 'eventually_due' },
      return_url: `${origin}/auth/kyc`, refresh_url: `${origin}/auth/kyc/refresh`,
    })).url,
  }
  return { ...context, store, provider, origin }
}

export async function checkoutContext(priceId: string, requestId: string) {
  const context = await authenticatedUser()
  if (!verifiedIdentity(context.user)) throw new OnboardingError(403, 'Confirme seu email antes de continuar.')
  requestBudget.take(`checkout:${context.user.id}`, 5)
  const { stripe, origin } = stripeConfiguration('checkout')
  const admin = createAdminClient()
  const store: CheckoutStore = {
    reserve: async () => {
      const { data, error } = await admin.rpc('reserve_stripe_checkout', { p_user_id: context.user.id, p_price_id: priceId, p_request_id: requestId })
      if (error || data?.length !== 1 || data[0].user_id !== context.user.id || data[0].price_id !== priceId) {
        throw new OnboardingError(error?.code === 'P0001' ? 429 : error?.code === 'P0002' ? 404 : ['23505', '23514'].includes(error?.code ?? '') ? 409 : 503,
          'Pedido indisponivel. Confira o preco, os limites e os pedidos em andamento.')
      }
      return data[0]
    },
    claim: async record => {
      const { data, error } = await admin.rpc('claim_stripe_checkout', { p_user_id: context.user.id, p_id: record.id })
      if (error) throw new OnboardingError(503, 'Nao foi possivel reservar o pedido.')
      return data?.[0] ?? null
    },
    bind: async (record, session) => {
      const { data, error } = await admin.from('stripe_checkout_requests').update({ creation_state: 'BOUND',
        stripe_session_id: session.id, checkout_url: session.url, expires_at: session.expires_at })
        .eq('id', record.id).eq('user_id', context.user.id).eq('creation_state', 'CREATING').select('id')
      if (error || data?.length !== 1) throw new Error('Checkout binding failed')
    },
    uncertain: async record => {
      const { error } = await admin.from('stripe_checkout_requests').update({ creation_state: 'UNCERTAIN' })
        .eq('id', record.id).eq('user_id', context.user.id).eq('creation_state', 'CREATING')
      if (error) throw new Error('Checkout uncertainty persistence failed')
    },
  }
  const provider: CheckoutProvider = {
    create: async record => {
      const price = await stripe.prices.retrieve(record.stripe_price_id)
      if (price.livemode !== false || !price.active || price.recurring || price.type !== 'one_time' ||
          price.unit_amount !== record.amount_cents || price.currency !== record.currency) throw new Error('Price mismatch')
      // No destination, transfer_data, account header or return URL comes from the browser.
      return stripe.checkout.sessions.create({ mode: 'payment', client_reference_id: context.user.id,
        line_items: [{ price: record.stripe_price_id, quantity: 1 }],
        success_url: `${origin}/dashboard/checkout`, cancel_url: `${origin}/dashboard/checkout`,
        metadata: { millennium_checkout_id: record.id },
      }, { idempotencyKey: `millennium-checkout-${record.id}` })
    },
  }
  return { ...context, store, provider }
}
