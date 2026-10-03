import { NextResponse } from 'next/server'
import { beginCheckout } from '@/lib/stripe/checkout'
import { checkoutContext } from '@/lib/stripe/server'
import { appOrigin, checkoutInput, sameOrigin, requestBudget } from '@/lib/stripe/guards'
import { boundedBody, apiError } from '@/lib/stripe/http'

export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin())
    requestBudget.take('checkout-ingress', 60)
    const input = checkoutInput(await boundedBody(request, 1024))
    const context = await checkoutContext(input.price_id, input.request_id)
    const url = await beginCheckout(context.store, context.provider)
    return NextResponse.json({ checkout_url: url }, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch (error) { return apiError(error) }
}
