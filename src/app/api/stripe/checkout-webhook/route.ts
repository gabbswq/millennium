import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { stripeConfiguration } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { boundedBody, apiError } from '@/lib/stripe/http'
import { OnboardingError } from '@/lib/stripe/onboarding'
import { paymentDisposition } from '@/lib/stripe/checkout'
import { UUID, requestBudget } from '@/lib/stripe/guards'
import { verifiedEvent } from '@/lib/stripe/webhooks'

const types = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'])
export async function POST(request: Request) {
  try {
    requestBudget.take('checkout-webhook-ingress', 120)
    const { stripe } = stripeConfiguration('checkout')
    const secret = process.env.STRIPE_CHECKOUT_WEBHOOK_SECRET
    const signature = request.headers.get('stripe-signature')
    const raw = await boundedBody(request, 65536)
    const event = verifiedEvent(stripe, raw, signature, secret)
    if (!types.has(event.type)) return NextResponse.json({ received: true, ignored: true })
    const session = event.data.object as import('stripe').default.Checkout.Session
    const state = paymentDisposition(event.type, session)
    const checkoutId = session.metadata?.millennium_checkout_id ?? ''
    if (!UUID.test(checkoutId) || !UUID.test(session.client_reference_id ?? '')) throw new OnboardingError(400, 'Identidade de pedido invalida.')
    const { data, error } = await createAdminClient().rpc('record_stripe_checkout_event', {
      p_event_id: event.id, p_fingerprint: createHash('sha256').update(raw).digest('hex'),
      p_checkout_id: checkoutId, p_user_id: session.client_reference_id!, p_session_id: session.id,
      p_amount: session.amount_total!, p_currency: session.currency!, p_state: state,
    })
    if (error) throw new OnboardingError(['P0002', '23514'].includes(error.code) ? 409 : 503, 'Evento nao persistido. Aguarde conciliacao.')
    return NextResponse.json({ received: true, duplicate: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiError(error) }
}
