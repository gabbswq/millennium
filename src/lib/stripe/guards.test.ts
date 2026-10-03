import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appOrigin, checkoutInput, checkoutUrl, sameOrigin, RequestBudget } from './guards'

const input = { price_id: '00000000-0000-4000-8000-000000000001', request_id: '00000000-0000-4000-8000-000000000002' }
test('checkout accepts only a price and an idempotency request UUID', () => {
  assert.deepEqual(checkoutInput(JSON.stringify(input)), input)
  for (const body of [null, [], {}, { ...input, amount: 1 }, { ...input, destination: 'acct_evil' }, { ...input, return_url: 'https://evil.test' }, { ...input, user_id: input.price_id }, { ...input, request_id: 'bad' }]) {
    assert.throws(() => checkoutInput(JSON.stringify(body)))
  }
})
test('same-origin guard rejects missing, foreign and cross-site requests', () => {
  const origin = 'https://millennium.example'
  sameOrigin(new Request(origin, { headers: { origin } }), origin)
  const variants: Record<string, string>[] = [{}, { origin: 'https://evil.test' }, { origin, 'sec-fetch-site': 'cross-site' }]
  for (const headers of variants) {
    assert.throws(() => sameOrigin(new Request(origin, { headers }), origin))
  }
})
test('return origin is server configured and rejects credentials, paths and nonlocal HTTP', () => {
  assert.equal(appOrigin('http://127.0.0.1:4313'), 'http://127.0.0.1:4313')
  for (const value of ['https://user:pass@host.test', 'https://host.test/path', 'http://host.test', 'https://host.test/?next=evil', 'not-url']) assert.throws(() => appOrigin(value))
})
test('checkout redirect is restricted to Stripe without lookalike domains', () => {
  assert.equal(checkoutUrl('https://checkout.stripe.com/c/pay/cs_test_fixture'), true)
  for (const value of ['https://checkout.stripe.com.evil.test', 'javascript:alert(1)', 'https://user:password@checkout.stripe.com', 'http://checkout.stripe.com', 'https://checkout.stripe.com:444']) assert.equal(checkoutUrl(value), false)
})
test('request limiter caps traffic, memory and resets after its window', () => {
  const limiter = new RequestBudget(2, 100)
  limiter.take('a', 1, 0)
  assert.throws(() => limiter.take('a', 1, 1))
  limiter.take('b', 5, 1)
  assert.throws(() => limiter.take('c', 5, 2))
  limiter.take('a', 1, 101)
})
