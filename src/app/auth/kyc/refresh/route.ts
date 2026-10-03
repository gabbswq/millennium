import { NextResponse } from 'next/server'
import { onboardingContext } from '@/lib/stripe/server'
import { trustedStripeUrl } from '@/lib/stripe/kyc'

export async function GET(request: Request) {
  try {
    const context = await onboardingContext()
    const { data, error } = await context.supabase.from('stripe_connected_accounts').select('*').eq('user_id', context.user.id).maybeSingle()
    if (error || data?.creation_state !== 'BOUND' || !data.stripe_account_id || data.livemode !== false) throw new Error('No bound account')
    const url = await context.provider.link(data.stripe_account_id)
    if (!trustedStripeUrl(url)) throw new Error('Invalid Stripe URL')
    return NextResponse.redirect(url, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch {
    return NextResponse.redirect(new URL('/auth/kyc', request.url), { headers: { 'Cache-Control': 'private, no-store' } })
  }
}
