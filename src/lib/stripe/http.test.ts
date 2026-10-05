import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apiError, boundedBody } from './http'
import { RequestBudget } from './guards'
import { OnboardingError } from './onboarding'

function streamingRequest(body: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  return new Request('https://fixture.test', { method: 'POST', body, signal, duplex: 'half' } as RequestInit)
}

async function rejectsPromptly(operation: Promise<unknown>, status: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await assert.rejects(Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Body reader failed to settle')), 1000)
    })]), (error: unknown) => error instanceof OnboardingError && error.status === status)
  } finally {
    clearTimeout(timer)
  }
}

test('body reading has a total deadline even when no bytes arrive', async () => {
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true } })
  await rejectsPromptly(boundedBody(streamingRequest(body), 1024, 20), 408)
  assert.equal(cancelled, true)
  assert.equal(body.locked, false)
})

test('cancellation cannot keep an oversized body reader waiting', async () => {
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(1025)) },
    cancel() { cancelled = true; return new Promise<void>(() => {}) },
  })
  await rejectsPromptly(boundedBody(streamingRequest(body), 1024), 413)
  assert.equal(cancelled, true)
  assert.equal(body.locked, false)
})

test('disconnecting the client stops reading without waiting for the deadline', async () => {
  const controller = new AbortController()
  const body = new ReadableStream<Uint8Array>()
  const operation = boundedBody(streamingRequest(body, controller.signal), 1024)
  controller.abort()
  await rejectsPromptly(operation, 400)
  assert.equal(body.locked, false)
})

test('small chunks cannot extend the total body deadline', async () => {
  let interval: ReturnType<typeof setInterval>
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    start(controller) { interval = setInterval(() => controller.enqueue(new Uint8Array([32])), 10) },
    cancel() { cancelled = true; clearInterval(interval) },
  })
  try {
    await rejectsPromptly(boundedBody(streamingRequest(body), 1024, 50), 408)
    assert.equal(cancelled, true)
    assert.equal(body.locked, false)
  } finally { clearInterval(interval!) }
})

test('an already aborted request is refused before locking the body', async () => {
  const controller = new AbortController()
  controller.abort()
  const body = new ReadableStream<Uint8Array>()
  await rejectsPromptly(boundedBody(streamingRequest(body, controller.signal), 1024), 400)
  assert.equal(body.locked, false)
})

test('split UTF-8 bytes are preserved for signature verification and the reader is released', async () => {
  const raw = '{"text":"\u00e9"}'
  const bytes = new TextEncoder().encode(raw)
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(bytes.slice(0, 10))
    controller.enqueue(bytes.slice(10))
    controller.close()
  } })
  assert.equal(await boundedBody(streamingRequest(body), bytes.length), raw)
  assert.equal(body.locked, false)
})

test('a failing source releases the reader without leaking its error through the API', async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('private-fixture-data')) } })
  let failure: unknown
  try { await boundedBody(streamingRequest(body), 1024) } catch (error) { failure = error }
  assert.equal(body.locked, false)
  const response = apiError(failure)
  assert.equal(response.status, 503)
  assert.equal((await response.text()).includes('private-fixture-data'), false)
})

test('rate-limit responses tell clients the remaining local window without caching', () => {
  const limiter = new RequestBudget(2, 5000)
  limiter.take('fixture', 1, 1000)
  let rejection: unknown
  try { limiter.take('fixture', 1, 3001) } catch (error) { rejection = error }
  const response = apiError(rejection)
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '3')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
})

test('memory saturation advertises the earliest expiry and accepts traffic afterwards', () => {
  const limiter = new RequestBudget(2, 5000)
  limiter.take('a', 2, 0)
  limiter.take('b', 2, 2000)
  let rejection: unknown
  try { limiter.take('c', 2, 3001) } catch (error) { rejection = error }
  assert.equal(apiError(rejection).headers.get('Retry-After'), '2')
  limiter.take('c', 2, 5000)
})

test('unknown daily quotas and ordinary errors do not invent a short Retry-After', () => {
  for (const error of [new Error('fixture'), new OnboardingError(429, 'Daily quota'),
    new OnboardingError(400, 'Invalid request', 3), new OnboardingError(429, 'Invalid delay', NaN)]) {
    assert.equal(apiError(error).headers.get('Retry-After'), null)
  }
})
