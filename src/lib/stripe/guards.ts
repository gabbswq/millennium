import { OnboardingError } from './onboarding'

export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export function appOrigin(value = process.env.MILLENNIUM_APP_ORIGIN): string {
  let url: URL
  try { url = new URL(value ?? '') } catch { throw new OnboardingError(503, 'Endereco do aplicativo nao configurado.') }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new OnboardingError(503, 'Endereco do aplicativo invalido.')
  }
  return url.origin
}

export function sameOrigin(request: Request, origin: string) {
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new OnboardingError(403, 'Origem invalida.')
  }
}

export function checkoutInput(raw: string): { price_id: string; request_id: string } {
  let input: unknown
  try { input = JSON.parse(raw) } catch { throw new OnboardingError(400, 'Requisicao invalida.') }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'price_id,request_id') {
    throw new OnboardingError(400, 'Envie somente o preco e o identificador da solicitacao.')
  }
  const body = input as Record<string, unknown>
  if (typeof body.price_id !== 'string' || typeof body.request_id !== 'string' || !UUID.test(body.price_id) || !UUID.test(body.request_id)) {
    throw new OnboardingError(400, 'Identificador invalido.')
  }
  return { price_id: body.price_id, request_id: body.request_id }
}

export function checkoutUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.username && !url.password && !url.port
  } catch { return false }
}

// Per-process backpressure is supplementary: hosting WAF and billing limits are still required.
export class RequestBudget {
  private buckets = new Map<string, { used: number; until: number }>()
  constructor(private maximum = 2000, private window = 60000) {}
  take(key: string, limit: number, now = Date.now()) {
    for (const [id, bucket] of this.buckets) if (bucket.until <= now) this.buckets.delete(id)
    const bucket = this.buckets.get(key) ?? { used: 0, until: now + this.window }
    if (bucket.used >= limit || !this.buckets.has(key) && this.buckets.size >= this.maximum) {
      const until = bucket.used >= limit ? bucket.until : Math.min(...Array.from(this.buckets.values(), value => value.until))
      throw new OnboardingError(429, 'Muitas solicitacoes. Tente novamente mais tarde.', Math.max(1, Math.ceil((until - now) / 1000)))
    }
    bucket.used++
    this.buckets.set(key, bucket)
  }
}

export const requestBudget = new RequestBudget()
