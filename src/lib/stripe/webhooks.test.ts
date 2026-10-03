import assert from 'node:assert/strict'
import { test } from 'node:test'
import Stripe from 'stripe'
import { verifiedEvent } from './webhooks'
import { boundedBody } from './http'

const stripe = new Stripe('sk_test_unit_fixture_not_a_credential')
const secret = 'whsec_unit_fixture_not_a_credential'
const payload = JSON.stringify({ id: 'evt_fixture', type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_test_fixture' } } })
const header = (body: string, timestamp = Math.floor(Date.now()/1000)) => stripe.webhooks.generateTestHeaderString({ payload: body, secret, timestamp })
test('SDK validates the original body and never accepts a mutated signature', () => {
  assert.equal(verifiedEvent(stripe, payload, header(payload), secret).id, 'evt_fixture')
  assert.throws(() => verifiedEvent(stripe, payload + ' ', header(payload), secret), /Assinatura invalida/)
  assert.throws(() => verifiedEvent(stripe, payload, null, secret), /obrigatoria/)
  assert.throws(() => verifiedEvent(stripe, payload, header(payload), undefined), /nao configurado/)
})
test('expired signatures, production and connected-account Checkout events are rejected', () => {
  assert.throws(() => verifiedEvent(stripe, payload, header(payload, 1), secret))
  for (const change of [{ livemode: true }, { account: 'acct_external' }]) {
    const raw = JSON.stringify({ ...JSON.parse(payload), ...change })
    assert.throws(() => verifiedEvent(stripe, raw, header(raw), secret), /autorizado/)
  }
})
test('streaming body limits apply even without Content-Length and count UTF-8 bytes', async () => {
  assert.equal(await boundedBody(new Request('https://fixture.test', { method: 'POST', body: '{}' }), 2), '{}')
  await assert.rejects(boundedBody(new Request('https://fixture.test', { method: 'POST', body: '\u00e9\u00e9' }), 3), /limite/)
})
