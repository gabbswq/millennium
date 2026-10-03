import type Stripe from 'stripe'
import { OnboardingError } from './onboarding'

export function verifiedEvent(stripe: Stripe, raw: string, signature: string | null, secret: string | undefined, connect = false): Stripe.Event {
  if (!secret?.startsWith('whsec_')) throw new OnboardingError(503, 'Webhook nao configurado.')
  if (!signature) throw new OnboardingError(400, 'Assinatura obrigatoria.')
  let event: Stripe.Event
  try { event = stripe.webhooks.constructEvent(raw, signature, secret) }
  catch { throw new OnboardingError(400, 'Assinatura invalida.') }
  if (event.livemode !== false || !connect && event.account) throw new OnboardingError(403, 'Evento fora do ambiente autorizado.')
  return event
}
