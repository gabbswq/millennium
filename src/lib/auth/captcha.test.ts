import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AuthError } from '@supabase/supabase-js'
import { authCaptchaConfiguration, captchaProtected, usableCaptchaToken } from './captcha'
import { mapAuthError } from '../../types/auth'

const enabled = authCaptchaConfiguration('true', '0xFixturePublicSiteKey')
test('CAPTCHA is opt-in and invalid flags or missing public keys fail closed', () => {
  assert.deepEqual(authCaptchaConfiguration('false', ''), { enabled: false, valid: true, siteKey: null })
  assert.equal(enabled.valid, true)
  for (const [flag, key] of [['TRUE', '0xFixture'], ['on', '0xFixture'], ['true', ''], ['true', ' https://evil.test'],
    ['true', 'x'.repeat(101)], ['true', 'key with spaces']]) {
    const configuration = authCaptchaConfiguration(flag, key)
    assert.equal(configuration.enabled, true); assert.equal(configuration.valid, false)
  }
})
test('empty, oversized and whitespace-padded challenge tokens are rejected', () => {
  for (const value of [undefined, null, '', ' ', ' token', 'token\n', 'x'.repeat(2049), 1, {}]) assert.equal(usableCaptchaToken(value), false)
  assert.equal(usableCaptchaToken('opaque-fixture-token'), true)
})
test('missing token and broken CAPTCHA configuration never invoke authentication', async () => {
  let calls = 0
  const action = async () => { calls++; return { error: null } }
  for (const token of [undefined, '', ' token', 'x'.repeat(2049)]) {
    assert.equal((await captchaProtected(token, action, enabled)).error?.code, 'captcha_failed')
  }
  assert.equal((await captchaProtected('fixture-token', action, authCaptchaConfiguration('true', ''))).error?.message, 'captcha_configuration_unavailable')
  assert.equal(calls, 0)
})
test('protected action receives the exact challenge token without persisting it', async () => {
  let options: { captchaToken?: string } | undefined
  const result = await captchaProtected('fixture-token', async received => { options = received; return { error: null } }, enabled)
  assert.equal(result.error, null); assert.deepEqual(options, { captchaToken: 'fixture-token' })
})
test('disabled integration preserves legacy auth without attaching CAPTCHA input', async () => {
  let options: { captchaToken?: string } | undefined
  await captchaProtected('unnecessary-fixture-token', async received => { options = received; return { error: null } }, authCaptchaConfiguration('false', ''))
  assert.deepEqual(options, {})
})
test('network errors are redacted and provider denials are returned without a success claim', async () => {
  const failed = await captchaProtected('fixture-token', async () => { throw new Error('private-fixture-upstream') }, enabled)
  assert.equal(failed.error?.message, 'auth_request_unavailable')
  const denied = new AuthError('captcha verification process failed', 400, 'captcha_failed')
  assert.equal((await captchaProtected('fixture-token', async () => ({ error: denied }), enabled)).error, denied)
  assert.equal(mapAuthError(denied.message, denied.code), 'Verificacao de seguranca pendente ou expirada.')
})
