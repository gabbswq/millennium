import { NextResponse } from 'next/server'
import { beginOnboarding, OnboardingError } from '@/lib/stripe/onboarding'
import { onboardingContext } from '@/lib/stripe/server'
import { apiError, boundedBody } from '@/lib/stripe/http'
import { appOrigin, sameOrigin, requestBudget } from '@/lib/stripe/guards'

export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin())
    requestBudget.take('onboarding-ingress', 30)
    const context = await onboardingContext()
    if (request.headers.get('origin') !== context.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      throw new OnboardingError(403, 'Origem invalida.')
    }
    const body = await boundedBody(request, 1024)
    let parsed: unknown
    try { parsed = JSON.parse(body) }
    catch { throw new OnboardingError(400, 'Requisicao invalida.') }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length) {
      throw new OnboardingError(400, 'Nao envie identidade ou conta nesta requisicao.')
    }
    const url = await beginOnboarding(context.store, context.provider)
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch (error) { return apiError(error) }
}
