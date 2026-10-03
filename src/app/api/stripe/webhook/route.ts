import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { stripeConfiguration } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, boundedBody } from '@/lib/stripe/http'
import { OnboardingError } from '@/lib/stripe/onboarding'
import { requestBudget } from '@/lib/stripe/guards'
import { verifiedEvent } from '@/lib/stripe/webhooks'

export async function POST(request: Request) {
  try {
    requestBudget.take('connect-webhook-ingress', 120)
    const { stripe } = stripeConfiguration()
    const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
    const signature = request.headers.get('stripe-signature')
    const raw = await boundedBody(request, 65536)
    const event = verifiedEvent(stripe, raw, signature, secret, true)
    if (event.type !== 'account.updated') return NextResponse.json({ received: true, ignored: true })
    const account = event.data.object
    if (!/^acct_[A-Za-z0-9]+$/.test(account.id) || event.account && event.account !== account.id) {
      throw new OnboardingError(400, 'Conta do evento inconsistente.')
    }
    const { data, error } = await createAdminClient().rpc('record_stripe_connect_event', {
      p_event_id: event.id, p_account_id: account.id, p_fingerprint: createHash('sha256').update(raw).digest('hex'), p_created: event.created,
    })
    if (error) throw new OnboardingError(error.code === 'P0002' || error.code === '23514' ? 409 : 503, 'Evento nao persistido. Aguarde conciliacao.')
    // Receipt history never grants access; the panel fetches current Stripe facts.
    return NextResponse.json({ received: true, duplicate: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiError(error) }
}
