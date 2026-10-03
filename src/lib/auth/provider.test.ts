import assert from 'node:assert/strict'
import { test } from 'node:test'
import { providerRecord } from './provider'

const identity = { id: 'provider-account', user_id: 'user-a', provider: 'google', identity_id: 'internal-uuid' }
const user = { id: 'user-a', email_confirmed_at: '2026-10-03', is_anonymous: false, identities: [identity],
  user_metadata: { sub: 'forged-account', role: 'admin' } }

test('OAuth sync binds the verified provider account, never editable user metadata', () => {
  assert.deepEqual(providerRecord(user, 'google'), { user_id: 'user-a', provider: 'google', provider_user_id: 'provider-account', provider_data: {} })
})
test('OAuth sync never falls back to the Supabase user ID when identity is absent', () => {
  assert.equal(providerRecord({ ...user, identities: undefined }, 'google'), null)
  assert.equal(providerRecord(user, 'discord'), null)
})
test('OAuth sync rejects a foreign or ambiguous identity', () => {
  assert.equal(providerRecord({ ...user, identities: [{ ...identity, user_id: 'user-b' }] }, 'google'), null)
  assert.equal(providerRecord({ ...user, identities: [identity, identity] }, 'google'), null)
})
test('OAuth sync rejects anonymous, unconfirmed, email and phone identities', () => {
  assert.equal(providerRecord({ ...user, is_anonymous: true }, 'google'), null)
  assert.equal(providerRecord({ ...user, email_confirmed_at: undefined }, 'google'), null)
  for (const provider of ['email', 'phone']) assert.equal(providerRecord({ ...user, identities: [{ ...identity, provider }] }, provider), null)
})
test('OAuth sync rejects blank, oversized and padded account IDs', () => {
  for (const id of ['', 'x'.repeat(256), ' account ']) assert.equal(providerRecord({ ...user, identities: [{ ...identity, id }] }, 'google'), null)
})
