import assert from 'node:assert/strict'
import { test } from 'node:test'
import { beginCheckout, paymentDisposition, type CheckoutRecord, type CheckoutStore, type CheckoutProvider } from './checkout'

function fixture() {
  let record: CheckoutRecord = { id: 'order', user_id: 'owner', price_id: 'price', request_id: 'request', stripe_price_id: 'price_fixture',
    amount_cents: 1000, currency: 'brl', creation_state: 'RESERVED', stripe_session_id: null, checkout_url: null, expires_at: null, payment_state: 'pending' }
  let calls = 0
  const store: CheckoutStore = {
    reserve: async () => ({ ...record }),
    claim: async () => { if (record.creation_state !== 'RESERVED') return null; record.creation_state = 'CREATING'; return { ...record } },
    bind: async (_, session) => { record = { ...record, creation_state: 'BOUND', stripe_session_id: session.id, checkout_url: session.url, expires_at: session.expires_at } },
    uncertain: async () => { record.creation_state = 'UNCERTAIN' },
  }
  const provider: CheckoutProvider = { create: async order => { calls++; return { id: 'cs_test_fixture', url: 'https://checkout.stripe.com/c/pay/fixture', livemode: false,
    expires_at: 2000, client_reference_id: order.user_id, metadata: { millennium_checkout_id: order.id } } } }
  return { store, provider, calls: () => calls, record: () => record, set: (change: Partial<CheckoutRecord>) => { record = { ...record, ...change } } }
}
test('checkout repeats the bound session without another Stripe POST', async () => {
  const f = fixture()
  assert.equal(await beginCheckout(f.store, f.provider, 1000), 'https://checkout.stripe.com/c/pay/fixture')
  await beginCheckout(f.store, f.provider, 1001)
  assert.equal(f.calls(), 1)
})
test('concurrent checkout requests acquire one claim', async () => {
  const f = fixture()
  const results = await Promise.allSettled([beginCheckout(f.store, f.provider, 1000), beginCheckout(f.store, f.provider, 1000)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(f.calls(), 1)
})
test('timeout and failed persistence freeze the request instead of charging twice', async () => {
  for (const failure of ['provider', 'database']) {
    const f = fixture()
    if (failure === 'provider') f.provider.create = async () => { throw new Error('private error') }
    else f.store.bind = async () => { throw new Error('private db error') }
    await assert.rejects(beginCheckout(f.store, f.provider, 1000), /nao confirmado/)
    assert.equal(f.record().creation_state, 'UNCERTAIN')
    await assert.rejects(beginCheckout(f.store, f.provider, 1000), /incerto/)
    assert.equal(f.calls(), failure === 'provider' ? 0 : 1)
  }
})
test('live, foreign, mismatched and expired provider sessions are never returned', async () => {
  for (const change of [{ livemode: true }, { client_reference_id: 'other' }, { metadata: {} }, { url: 'https://evil.test' }, { id: 'cs_live_other' }, { expires_at: 1 }]) {
    const f = fixture(); const create = f.provider.create
    f.provider.create = async order => ({ ...await create(order), ...change })
    await assert.rejects(beginCheckout(f.store, f.provider, 1000))
    assert.equal(f.record().creation_state, 'UNCERTAIN')
  }
})
test('closed and expired checkouts cannot be reopened', async () => {
  const f = fixture(); await beginCheckout(f.store, f.provider, 1000)
  await assert.rejects(beginCheckout(f.store, f.provider, 3000), /expirado/)
  f.set({ payment_state: 'paid' })
  await assert.rejects(beginCheckout(f.store, f.provider, 1000), /encerrado/)
  assert.equal(f.calls(), 1)
})
const session = { id: 'cs_test_fixture', livemode: false, mode: 'payment', client_reference_id: 'owner',
  metadata: { millennium_checkout_id: 'order' }, amount_total: 1000, currency: 'brl', payment_status: 'paid' }
test('completed alone is not paid; delayed payment needs a paid signed session', () => {
  assert.equal(paymentDisposition('checkout.session.completed', { ...session, payment_status: 'unpaid' }), 'pending')
  assert.equal(paymentDisposition('checkout.session.completed', session), 'paid')
  assert.equal(paymentDisposition('checkout.session.async_payment_succeeded', session), 'paid')
  assert.throws(() => paymentDisposition('checkout.session.async_payment_succeeded', { ...session, payment_status: 'unpaid' }))
})
test('invalid payment facts and incompatible event states fail closed', () => {
  for (const change of [{ livemode: true }, { mode: 'subscription' }, { metadata: {} }, { amount_total: 0 }, { currency: 'usd' }, { payment_status: 'no_payment_required' }]) {
    assert.throws(() => paymentDisposition('checkout.session.completed', { ...session, ...change }))
  }
  assert.equal(paymentDisposition('checkout.session.expired', { ...session, payment_status: 'unpaid' }), 'expired')
  assert.equal(paymentDisposition('checkout.session.async_payment_failed', { ...session, payment_status: 'unpaid' }), 'failed')
  assert.throws(() => paymentDisposition('checkout.session.expired', session))
})
