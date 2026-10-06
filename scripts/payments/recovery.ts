import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'
import { UUID } from '../../src/lib/stripe/guards'
import { isStripeTestSecretKey } from '../../src/lib/stripe/keys'
import { CheckoutRecoveryError, recoverCheckout, type RecoveryRequest, type RecoveryStore, type RecoveryProvider } from '../../src/lib/stripe/recovery'

export function parseRecoveryArguments(args: string[]): RecoveryRequest {
  const values = new Map<string, string>()
  let bindOpen = false
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]
    if (flag === '--bind-open' && !bindOpen) { bindOpen = true; continue }
    if (!['--checkout', '--session'].includes(flag) || values.has(flag) || !args[i + 1]) {
      throw new CheckoutRecoveryError('INVALID_ARGUMENTS')
    }
    values.set(flag, args[++i])
  }
  const checkoutId = values.get('--checkout')?.toLowerCase() ?? '', sessionId = values.get('--session') ?? ''
  if (!UUID.test(checkoutId) || !/^cs_test_[A-Za-z0-9]{1,200}$/.test(sessionId)) {
    throw new CheckoutRecoveryError('INVALID_ARGUMENTS')
  }
  return { checkoutId, sessionId, bindOpen }
}

export function recoveryConfiguration(environment: NodeJS.ProcessEnv) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const databaseKey = environment.SUPABASE_SERVICE_ROLE_KEY
  const stripeKey = environment.STRIPE_SECRET_KEY
  // No proxy, custom host, local fallback or live provider can receive privileged credentials.
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url) || !databaseKey ||
      !isStripeTestSecretKey(stripeKey)) {
    throw new CheckoutRecoveryError('CONFIGURATION_UNAVAILABLE')
  }
  return { url, databaseKey, stripeKey }
}

export function recoveryPorts(environment: NodeJS.ProcessEnv, fetchImplementation?: typeof fetch): { store: RecoveryStore; provider: RecoveryProvider } {
  const configuration = recoveryConfiguration(environment)
  const admin = createClient<Database>(configuration.url, configuration.databaseKey,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: fetchImplementation ? { fetch: fetchImplementation } : undefined })
  const stripe = new Stripe(configuration.stripeKey, { timeout: 10000, maxNetworkRetries: 0,
    httpClient: fetchImplementation ? Stripe.createFetchHttpClient(fetchImplementation) : undefined })
  return {
    store: {
      load: async id => {
        const { data, error } = await admin.from('stripe_checkout_requests').select('*').eq('id', id)
          .retry(false).abortSignal(AbortSignal.timeout(10000)).maybeSingle()
        if (error) throw new CheckoutRecoveryError('DATABASE_READ_FAILED')
        return data
      },
      bindOpen: async (record, session) => {
        // Compare-and-set: a webhook, original creator or second operator must win, never be overwritten.
        const { data, error } = await admin.from('stripe_checkout_requests')
          .update({ creation_state: 'BOUND', stripe_session_id: session.id, checkout_url: session.url, expires_at: session.expires_at })
          .eq('id', record.id).eq('user_id', record.user_id).eq('request_id', record.request_id)
          .eq('creation_state', record.creation_state).eq('payment_state', 'pending').eq('updated_at', record.updated_at)
          .is('stripe_session_id', null).is('checkout_url', null).is('expires_at', null)
          .select('id').retry(false).abortSignal(AbortSignal.timeout(10000))
        if (error) throw new CheckoutRecoveryError('BIND_OUTCOME_UNCONFIRMED_READ_AGAIN')
        return data?.length === 1 && data[0].id === record.id
      },
    },
    provider: { retrieve: id => stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] }) },
  }
}

export async function runRecoveryCommand(args: string[], environment: NodeJS.ProcessEnv = process.env) {
  const request = parseRecoveryArguments(args)
  const { store, provider } = recoveryPorts(environment)
  return recoverCheckout(store, provider, request)
}
