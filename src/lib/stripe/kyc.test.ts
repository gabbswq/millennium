import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateKyc, trustedStripeUrl, verifiedIdentity, type AccountFacts } from './kyc'

const ready: AccountFacts = {
  id: 'acct_fixture', details_submitted: true, charges_enabled: true, payouts_enabled: true,
  capabilities: { card_payments: 'active', transfers: 'active' },
  requirements: { currently_due: [], past_due: [], pending_verification: [], disabled_reason: null },
}

test('only a complete provider snapshot enables access', () => {
  assert.equal(evaluateKyc(ready, ready.id).state, 'ready')
})
test('return URL, details submitted or truthy strings do not approve an account', () => {
  assert.equal(evaluateKyc({ ...ready, charges_enabled: false }, ready.id).state, 'blocked')
  assert.equal(evaluateKyc({ ...ready, payouts_enabled: false }, ready.id).state, 'blocked')
  assert.equal(evaluateKyc({ ...ready, charges_enabled: 'true' as unknown as boolean }, ready.id).state, 'blocked')
  assert.equal(evaluateKyc({ id: ready.id, details_submitted: true }, ready.id).state, 'blocked')
})
test('pending, overdue and reviewing requirements remain blocked', () => {
  assert.deepEqual(evaluateKyc({ ...ready, requirements: { ...ready.requirements, currently_due: ['company.tax_id'], past_due: ['company.tax_id'] } }, ready.id),
    { state: 'pending', pendingCount: 1, reviewingCount: 0 })
  assert.equal(evaluateKyc({ ...ready, requirements: { ...ready.requirements, pending_verification: ['individual.verification.document'] } }, ready.id).state, 'review')
  assert.equal(evaluateKyc({ ...ready, details_submitted: false }, ready.id).state, 'pending')
})
test('missing, inactive and rejected capabilities do not enable the panel', () => {
  for (const capabilities of [undefined, { card_payments: 'active' }, { card_payments: 'pending', transfers: 'active' }]) {
    assert.equal(evaluateKyc({ ...ready, capabilities }, ready.id).state, 'blocked')
  }
  assert.equal(evaluateKyc({ ...ready, requirements: { ...ready.requirements, disabled_reason: 'rejected.fraud' } }, ready.id).state, 'blocked')
})
test('wrong account, deleted account and incomplete requirements fail closed', () => {
  assert.equal(evaluateKyc(ready, 'acct_another').state, 'blocked')
  assert.equal(evaluateKyc({ ...ready, deleted: true }, ready.id).state, 'blocked')
  assert.equal(evaluateKyc({ ...ready, requirements: null }, ready.id).state, 'blocked')
  assert.equal(evaluateKyc({ ...ready, requirements: { currently_due: [] } }, ready.id).state, 'blocked')
})
test('email confirmation and nonanonymous server identity are mandatory', () => {
  const user = { id: '00000000-0000-4000-8000-000000000001', email_confirmed_at: '2026-10-03T12:00:00Z' }
  assert.equal(verifiedIdentity(user), true)
  assert.equal(verifiedIdentity(null), false)
  assert.equal(verifiedIdentity({ ...user, is_anonymous: true }), false)
  assert.equal(verifiedIdentity({ ...user, email_confirmed_at: null }), false)
  assert.equal(verifiedIdentity({ ...user, id: 'client-provided-id' }), false)
})
test('onboarding redirects accept only the Stripe-hosted origin', () => {
  assert.equal(trustedStripeUrl('https://connect.stripe.com/setup/e/acct_fixture/token'), true)
  for (const value of ['javascript:alert(1)', 'https://connect.stripe.com.evil.test/',
    'https://evil.test/?next=connect.stripe.com', 'https://user:password@connect.stripe.com/',
    'http://connect.stripe.com/', '/dashboard', 'https://connect.stripe.com:444/']) {
    assert.equal(trustedStripeUrl(value), false)
  }
})
