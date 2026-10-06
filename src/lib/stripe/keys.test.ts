import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStripeTestSecretKey } from './keys'

test('server policy accepts secret and restricted test keys', () => {
  for (const prefix of ['sk_test_', 'rk_test_']) {
    assert.equal(isStripeTestSecretKey(prefix + 'disposableFixtureOnly'), true)
  }
})

test('test key policy preserves the minimum length for both prefixes', () => {
  for (const prefix of ['sk_test_', 'rk_test_']) {
    assert.equal(isStripeTestSecretKey(prefix + 'a'.repeat(8)), false)
    assert.equal(isStripeTestSecretKey(prefix + 'a'.repeat(9)), true)
  }
})

test('live, publishable, organization and webhook keys cannot enable Stripe', () => {
  for (const prefix of ['sk_live_', 'rk_live_', 'pk_test_', 'pk_live_', 'sk_org_', 'whsec_']) {
    assert.equal(isStripeTestSecretKey(prefix + 'disposableFixtureOnly'), false)
  }
})

test('malformed keys are refused without normalization or coercion', () => {
  const fixture = 'rk_test_disposableFixtureOnly'
  for (const value of [undefined, null, {}, [fixture], 123, '', 'rk_test_',
    fixture.toUpperCase(), ` ${fixture}`, `${fixture} `, `${fixture}\n`,
    `${fixture}\r\n`, `${fixture}\0`, fixture + '/', fixture + '_',
    fixture.replace('Fixture', 'Fix ture'), fixture + '\u00e9']) {
    assert.equal(isStripeTestSecretKey(value), false)
  }
})
