import assert from 'node:assert/strict'
import { test } from 'node:test'
import { beginOnboarding, OnboardingError, type Connection, type ConnectionStore, type OnboardingProvider } from './onboarding'

function fixture() {
  const record: Connection = { user_id: 'owner-fixture', request_id: 'request-fixture', stripe_account_id: null, creation_state: 'RESERVED', livemode: false }
  let calls = 0
  const store: ConnectionStore = {
    reserve: async () => ({ ...record }),
    claim: async () => {
      if (record.creation_state !== 'RESERVED') return null
      record.creation_state = 'CREATING'
      return { ...record }
    },
    bind: async (_, id) => { record.stripe_account_id = id; record.creation_state = 'BOUND' },
    uncertain: async () => { if (record.creation_state === 'CREATING') record.creation_state = 'UNCERTAIN' },
  }
  const provider: OnboardingProvider = {
    create: async request => { calls++; return { id: 'acct_fixture', metadata: { millennium_request_id: request } } },
    link: async () => 'https://connect.stripe.com/setup/fixture',
  }
  return { store, provider, calls: () => calls, state: () => record.creation_state, set: (state: Connection['creation_state']) => { record.creation_state = state } }
}
const errorStatus = (status: number) => (error: unknown) => error instanceof OnboardingError && error.status === status

test('onboarding creates one account and later renews links without another account POST', async () => {
  const f = fixture()
  assert.equal(await beginOnboarding(f.store, f.provider), 'https://connect.stripe.com/setup/fixture')
  await beginOnboarding(f.store, f.provider)
  assert.equal(f.calls(), 1)
})
test('two simultaneous requests cannot both create an account', async () => {
  const f = fixture()
  const results = await Promise.allSettled([beginOnboarding(f.store, f.provider), beginOnboarding(f.store, f.provider)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(f.calls(), 1)
})
test('timeout preserves uncertain state and no subsequent call repeats POST', async () => {
  const f = fixture()
  f.provider.create = async () => { throw new Error('private provider error') }
  await assert.rejects(beginOnboarding(f.store, f.provider), errorStatus(503))
  assert.equal(f.state(), 'UNCERTAIN')
  await assert.rejects(beginOnboarding(f.store, f.provider), errorStatus(409))
})
test('persistence failure after creation does not silently retry the provider', async () => {
  const f = fixture()
  f.store.bind = async () => { throw new Error('disk failure') }
  await assert.rejects(beginOnboarding(f.store, f.provider), errorStatus(503))
  await assert.rejects(beginOnboarding(f.store, f.provider), errorStatus(409))
  assert.equal(f.calls(), 1)
})
test('a mismatched provider identity is never bound', async () => {
  const f = fixture()
  f.provider.create = async () => ({ id: 'acct_other', metadata: { millennium_request_id: 'other-request' } })
  await assert.rejects(beginOnboarding(f.store, f.provider), errorStatus(503))
  assert.equal(f.state(), 'UNCERTAIN')
})
test('link failure does not destroy the bound account and renew is safe', async () => {
  const f = fixture()
  f.provider.link = async () => { throw new Error('temporary failure') }
  await assert.rejects(beginOnboarding(f.store, f.provider), errorStatus(503))
  assert.equal(f.state(), 'BOUND')
  f.provider.link = async () => 'https://connect.stripe.com/setup/renewed'
  await beginOnboarding(f.store, f.provider)
  assert.equal(f.calls(), 1)
})
test('a hostile provider redirect is rejected without exposing it to the user', async () => {
  const f = fixture()
  f.provider.link = async () => 'https://evil.test/'
  await assert.rejects(beginOnboarding(f.store, f.provider), errorStatus(502))
})
test('live connection is rejected before creating an account', async () => {
  const f = fixture()
  f.store.reserve = async () => ({ user_id: 'owner', request_id: 'request', stripe_account_id: null, creation_state: 'RESERVED', livemode: true })
  await assert.rejects(beginOnboarding(f.store, f.provider), errorStatus(403))
  assert.equal(f.calls(), 0)
})
