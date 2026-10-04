import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { CheckoutRecoveryError, recoverCheckout, type RecoveryRecord, type RecoverySession, type RecoveryRequest, type RecoveryStore, type RecoveryProvider } from './recovery'
import { parseRecoveryArguments, recoveryConfiguration, recoveryPorts } from '../../../scripts/payments/recovery'

const now = Date.UTC(2026, 9, 3, 12), earlier = new Date(now - 300000).toISOString()
const checkoutId = '00000000-0000-4000-8000-000000000001', owner = '00000000-0000-4000-8000-000000000002'
const request: RecoveryRequest = { checkoutId, sessionId: 'cs_test_fixture', bindOpen: false }
const code = (value: string) => (error: unknown) => error instanceof CheckoutRecoveryError && error.code === value
function fixture() {
  let record: RecoveryRecord = { id: checkoutId, user_id: owner, price_id: owner, request_id: owner,
    stripe_price_id: 'price_fixture', amount_cents: 1000, currency: 'brl', creation_state: 'UNCERTAIN',
    payment_state: 'pending', stripe_session_id: null, checkout_url: null, expires_at: null,
    created_at: earlier, updated_at: earlier }
  const session: RecoverySession = { id: request.sessionId, livemode: false, mode: 'payment', ui_mode: 'hosted_page',
    client_reference_id: owner, metadata: { millennium_checkout_id: checkoutId }, amount_subtotal: 1000, amount_total: 1000,
    currency: 'brl', payment_status: 'unpaid', status: 'open', created: (now - 200000) / 1000,
    expires_at: (now + 1000000) / 1000, url: 'https://checkout.stripe.com/c/pay/fixture',
    line_items: { has_more: false, data: [{ quantity: 1, currency: 'brl', amount_total: 1000, amount_subtotal: 1000,
      price: { id: 'price_fixture', currency: 'brl', livemode: false, type: 'one_time', recurring: null, unit_amount: 1000 } }] } }
  let reads = 0, gets = 0, writes = 0
  const store: RecoveryStore = {
    load: async () => { reads++; return { ...record } },
    bindOpen: async (snapshot, remote) => {
      writes++
      if (record.creation_state !== snapshot.creation_state || record.updated_at !== snapshot.updated_at || record.payment_state !== 'pending') return false
      record = { ...record, creation_state: 'BOUND', stripe_session_id: remote.id, checkout_url: remote.url, expires_at: remote.expires_at,
        updated_at: new Date(now).toISOString() }
      return true
    },
  }
  const provider: RecoveryProvider = { retrieve: async () => { gets++; return session } }
  return { store, provider, session, record: () => record, set: (change: Partial<RecoveryRecord>) => { record = { ...record, ...change } },
    calls: () => ({ reads, gets, writes }) }
}

test('recovery inspects by default without writes, POST, paid state or redirect disclosure', async () => {
  const f = fixture(), result = await recoverCheckout(f.store, f.provider, request, now)
  assert.deepEqual(result, { checkoutId, sessionId: request.sessionId, applied: false, outcome: 'READY_TO_BIND' })
  assert.deepEqual(f.calls(), { reads: 1, gets: 1, writes: 0 })
  assert.equal(f.record().creation_state, 'UNCERTAIN')
  assert.ok(!JSON.stringify(result).includes('https://'))
})
test('explicit recovery binds existing open session once and remains idempotent', async () => {
  const f = fixture()
  assert.equal((await recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now)).outcome, 'OPEN_SESSION_BOUND')
  assert.equal(f.record().payment_state, 'pending')
  assert.equal((await recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now)).outcome, 'ALREADY_BOUND')
  assert.equal(f.calls().writes, 1)
})
test('two operators cannot overwrite a winning bind', async () => {
  const f = fixture()
  const results = await Promise.allSettled([recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now),
    recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const rejected = results.find(result => result.status === 'rejected')
  assert.ok(rejected?.status === 'rejected' && code('CONCURRENT_CHANGE_READ_AGAIN')(rejected.reason))
})
test('complete, paid and expired sessions require review and never mark payment paid', async () => {
  for (const status of ['complete', 'expired'] as const) {
    const f = fixture(); f.session.status = status; f.session.url = null
    if (status === 'complete') f.session.payment_status = 'paid'
    const result = await recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now)
    assert.equal(result.outcome, 'TERMINAL_SESSION_REQUIRES_REVIEW')
    assert.equal(result.applied, false); assert.equal(f.calls().writes, 0)
    assert.equal(f.record().payment_state, 'pending')
  }
})
test('invalid request, not found and malformed database rows stop before Stripe reads', async () => {
  const f = fixture()
  await assert.rejects(recoverCheckout(f.store, f.provider, { ...request, sessionId: 'cs_live_wrong' }, now), code('INVALID_REQUEST'))
  assert.equal(f.calls().reads, 0)
  f.store.load = async () => null
  await assert.rejects(recoverCheckout(f.store, f.provider, request, now), code('CHECKOUT_NOT_FOUND'))
  f.store.load = async () => ({ id: checkoutId })
  await assert.rejects(recoverCheckout(f.store, f.provider, request, now), code('UNSAFE_RECORD'))
  assert.equal(f.calls().gets, 0)
})
test('recent attempts, changed owners, unsafe states and contradictory bindings fail closed', async () => {
  for (const change of [{ updated_at: new Date(now - 119999).toISOString() }, { creation_state: 'RESERVED' },
    { payment_state: 'paid' }, { id: owner }, { stripe_session_id: 'cs_test_other' }, { checkout_url: 'https://evil.test' },
    { updated_at: new Date(now + 1).toISOString() }, { updated_at: new Date(now - 600000).toISOString() }] as Partial<RecoveryRecord>[]) {
    const f = fixture(); f.set(change)
    await assert.rejects(recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now))
    assert.equal(f.calls().gets, 0); assert.equal(f.calls().writes, 0)
  }
})
test('sessions must match exact test identity, amount, currency, price and single quantity', async () => {
  const changes: ((session: RecoverySession) => void)[] = [
    session => { Object.assign(session, { livemode: true }) }, session => { session.id = 'cs_test_other' },
    session => { session.client_reference_id = checkoutId }, session => { session.metadata.millennium_checkout_id = owner },
    session => { session.amount_total = 1 }, session => { session.amount_subtotal = 1 },
    session => { Object.assign(session, { currency: 'usd' }) }, session => { Object.assign(session, { mode: 'subscription' }) },
    session => { Object.assign(session, { ui_mode: 'elements' }) }, session => { session.line_items.data[0].price.id = 'price_other' },
    session => { session.line_items.data[0].price.unit_amount = 1 }, session => { session.line_items.data[0].amount_total = 1 },
    session => { Object.assign(session.line_items.data[0], { quantity: 2 }) },
    session => { Object.assign(session.line_items, { has_more: true }) }, session => { session.line_items.data.push(session.line_items.data[0]) },
    session => { session.payment_status = 'paid' }, session => { session.url = 'https://evil.test' },
    session => { session.created = now / 1000 + 31 }, session => { session.created = (now - 1000000) / 1000 },
    session => { session.expires_at = session.created }, session => { Object.assign(session.line_items.data[0].price, { livemode: true }) },
    session => { Object.assign(session.line_items.data[0].price, { recurring: { interval: 'month' } }) },
  ]
  for (const change of changes) {
    const f = fixture(); change(f.session)
    await assert.rejects(recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now), code('SESSION_MISMATCH'))
    assert.equal(f.calls().writes, 0)
  }
})
test('open but elapsed sessions cannot be bound', async () => {
  const f = fixture(); f.session.expires_at = now / 1000
  assert.equal((await recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now)).outcome, 'TERMINAL_SESSION_REQUIRES_REVIEW')
  assert.equal(f.calls().writes, 0)
})
test('foreign bound session is never overwritten', async () => {
  const f = fixture(); f.set({ creation_state: 'BOUND', stripe_session_id: 'cs_test_other', checkout_url: f.session.url, expires_at: f.session.expires_at })
  await assert.rejects(recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now), code('BINDING_MISMATCH'))
  assert.equal(f.calls().gets, 0)
})
test('upstream errors and ambiguous writes are redacted; mutation is not retried', async () => {
  for (const phase of ['database', 'stripe', 'bind']) {
    const f = fixture(), secret = 'fixture-private-message'
    if (phase === 'database') f.store.load = async () => { throw new Error(secret) }
    if (phase === 'stripe') f.provider.retrieve = async () => { throw new Error(secret) }
    if (phase === 'bind') f.store.bindOpen = async () => { throw new Error(secret) }
    await assert.rejects(recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now), error =>
      error instanceof CheckoutRecoveryError && !error.message.includes(secret))
  }
})
test('lost response after a committed binding is resolved by reading, not another mutation', async () => {
  const f = fixture(), bind = f.store.bindOpen
  f.store.bindOpen = async (record, session) => { await bind(record, session); throw new Error('fixture-lost-response') }
  await assert.rejects(recoverCheckout(f.store, f.provider, { ...request, bindOpen: true }, now), code('BIND_OUTCOME_UNCONFIRMED_READ_AGAIN'))
  assert.equal(f.record().creation_state, 'BOUND')
  assert.equal((await recoverCheckout(f.store, f.provider, request, now)).outcome, 'ALREADY_BOUND')
  assert.equal(f.calls().writes, 1)
})
test('CLI argument parser rejects extra, duplicate and dangerous input without echoing it', () => {
  assert.deepEqual(parseRecoveryArguments(['--checkout', checkoutId.toUpperCase(), '--session', request.sessionId]), request)
  for (const args of [[], ['--checkout', checkoutId], ['--checkout', checkoutId, '--session', 'cs_live_wrong'],
    ['--checkout', checkoutId, '--session', request.sessionId, '--force'], ['--checkout', checkoutId, '--session', request.sessionId, '--bind-open', '--bind-open'],
    ['--checkout', checkoutId, '--checkout', owner, '--session', request.sessionId]]) {
    assert.throws(() => parseRecoveryArguments(args), code('INVALID_ARGUMENTS'))
  }
})
const environment = { NODE_ENV: 'test' as const, NEXT_PUBLIC_SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'disposable-fixture-only', STRIPE_SECRET_KEY: 'sk_test_disposableFixtureOnly' }
test('CLI refuses live key and untrusted database hosts before initializing SDKs', () => {
  for (const change of [{ STRIPE_SECRET_KEY: 'sk_live_disposableFixtureOnly' }, { STRIPE_SECRET_KEY: '' },
    { SUPABASE_SERVICE_ROLE_KEY: '' }, { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://evil.test' }, { NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL + '/?secret=x' }]) {
    assert.throws(() => recoveryConfiguration({ ...environment, ...change }), code('CONFIGURATION_UNAVAILABLE'))
  }
})
test('official SDK adapter sends only GETs on inspection and a conditional binding PATCH on apply', async () => {
  const f = fixture(), calls: Request[] = []
  const fakeFetch: typeof fetch = async (input, init) => {
    const call = new Request(input, init); calls.push(call)
    const url = new URL(call.url)
    let data: unknown
    if (url.hostname === 'api.stripe.com') {
      assert.equal(call.method, 'GET')
      assert.equal(url.pathname, `/v1/checkout/sessions/${request.sessionId}`)
      assert.equal(url.searchParams.get('expand[0]'), 'line_items')
      data = f.session
    } else {
      assert.equal(url.hostname, 'aaaaaaaaaaaaaaaaaaaa.supabase.co')
      assert.equal(url.pathname, '/rest/v1/stripe_checkout_requests')
      assert.equal(url.searchParams.get('id'), `eq.${checkoutId}`)
      if (call.method === 'PATCH') {
        assert.equal(url.searchParams.get('user_id'), `eq.${owner}`)
        assert.equal(url.searchParams.get('request_id'), `eq.${owner}`)
        assert.equal(url.searchParams.get('updated_at'), `eq.${earlier}`)
        assert.equal(url.searchParams.get('creation_state'), 'eq.UNCERTAIN')
        assert.equal(url.searchParams.get('payment_state'), 'eq.pending')
        for (const field of ['stripe_session_id', 'checkout_url', 'expires_at']) assert.equal(url.searchParams.get(field), 'is.null')
        assert.deepEqual(await call.json(), { creation_state: 'BOUND', stripe_session_id: request.sessionId,
          checkout_url: f.session.url, expires_at: f.session.expires_at })
        data = [{ id: checkoutId }]
      } else { assert.equal(call.method, 'GET'); data = f.record() }
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const ports = recoveryPorts(environment, fakeFetch)
  assert.equal((await recoverCheckout(ports.store, ports.provider, request, now)).outcome, 'READY_TO_BIND')
  assert.ok(calls.every(call => call.method === 'GET'))
  assert.equal((await recoverCheckout(ports.store, ports.provider, { ...request, bindOpen: true }, now)).applied, true)
  assert.deepEqual(calls.map(call => call.method), ['GET', 'GET', 'GET', 'GET', 'PATCH'])
})
test('standalone CLI help and invalid input never require credentials or print supplied secrets', () => {
  const entry = 'scripts/payments/recover-checkout.mjs'
  const help = spawnSync(process.execPath, ['--import', 'tsx', entry, '--help'], { encoding: 'utf8', env: { NODE_ENV: 'test' } })
  assert.equal(help.status, 0, help.stderr); assert.match(help.stdout, /Default: inspect only/)
  const failure = spawnSync(process.execPath, ['--import', 'tsx', entry, '--checkout', 'fixture-private-input'], { encoding: 'utf8', env: { NODE_ENV: 'test' } })
  assert.equal(failure.status, 1); assert.ok(!failure.stderr.includes('fixture-private-input'))
  assert.match(failure.stderr, /INVALID_ARGUMENTS/)
})

test('official SDKs do not amplify transient errors or repeat an ambiguous binding', async () => {
  for (const phase of ['database', 'stripe', 'bind']) {
    const f = fixture(), calls: Request[] = []
    const fakeFetch: typeof fetch = async (input, init) => {
      const call = new Request(input, init); calls.push(call)
      const isStripe = new URL(call.url).hostname === 'api.stripe.com'
      if (phase === 'database' && !isStripe || phase === 'stripe' && isStripe || phase === 'bind' && call.method === 'PATCH') {
        return new Response(JSON.stringify({ error: { message: 'fixture-private-upstream-error' } }),
          { status: 503, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify(isStripe ? f.session : f.record()), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const ports = recoveryPorts(environment, fakeFetch)
    await assert.rejects(recoverCheckout(ports.store, ports.provider, { ...request, bindOpen: true }, now),
      code(phase === 'database' ? 'DATABASE_READ_FAILED' : phase === 'stripe' ? 'STRIPE_READ_FAILED' : 'BIND_OUTCOME_UNCONFIRMED_READ_AGAIN'))
    assert.equal(calls.length, phase === 'database' ? 1 : phase === 'stripe' ? 2 : 3)
    assert.equal(calls.filter(call => call.method === 'POST').length, 0)
  }
})
