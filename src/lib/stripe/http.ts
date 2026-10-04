import { NextResponse } from 'next/server'
import { OnboardingError } from './onboarding'

export function apiError(error: unknown) {
  const headers = new Headers({ 'Cache-Control': 'private, no-store' })
  if (error instanceof OnboardingError && error.status === 429 &&
      typeof error.retryAfterSeconds === 'number' && Number.isSafeInteger(error.retryAfterSeconds) && error.retryAfterSeconds > 0) {
    headers.set('Retry-After', String(error.retryAfterSeconds))
  }
  return NextResponse.json({ error: error instanceof OnboardingError ? error.message : 'Servico temporariamente indisponivel.' },
    { status: error instanceof OnboardingError ? error.status : 503, headers })
}

export async function boundedBody(request: Request, limit: number, timeoutMs = 5000): Promise<string> {
  if (request.signal.aborted) throw new OnboardingError(400, 'Requisicao interrompida.')
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  let interrupt!: (error: Error) => void
  const interrupted = new Promise<never>((_, reject) => { interrupt = reject })
  const abort = () => interrupt(new OnboardingError(400, 'Requisicao interrompida.'))
  const timer = setTimeout(() => interrupt(new OnboardingError(408, 'Tempo de leitura da requisicao excedido.')), timeoutMs)
  request.signal.addEventListener('abort', abort, { once: true })
  const read = async () => {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new OnboardingError(413, 'Requisicao acima do limite.')
      if (value.byteLength) chunks.push(value)
    }
    return Buffer.concat(chunks).toString('utf8')
  }
  try {
    return await Promise.race([read(), interrupted])
  } catch (error) {
    // An uncooperative stream must not hold the response open during cancellation.
    void reader.cancel().catch(() => {})
    throw error
  } finally {
    clearTimeout(timer)
    request.signal.removeEventListener('abort', abort)
    reader.releaseLock()
  }
}
