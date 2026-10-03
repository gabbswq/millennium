import { NextResponse } from 'next/server'
import { OnboardingError } from './onboarding'

export function apiError(error: unknown) {
  return NextResponse.json({ error: error instanceof OnboardingError ? error.message : 'Servico temporariamente indisponivel.' },
    { status: error instanceof OnboardingError ? error.status : 503, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function boundedBody(request: Request, limit: number): Promise<string> {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new OnboardingError(413, 'Requisicao acima do limite.')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks).toString('utf8')
}
