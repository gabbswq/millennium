import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002'
const price = '10000000-0000-4000-8000-000000000001', price2 = '10000000-0000-4000-8000-000000000002'
const key = '20000000-0000-4000-8000-000000000001'
let order
before(async () => {
  await db.exec(await readFile(new URL('../../payments-sandbox/database/tests/bootstrap.sql', import.meta.url), 'utf8'))
  await db.exec(`CREATE TABLE public.products (id uuid PRIMARY KEY, active boolean);
    CREATE TABLE public.prices(id uuid PRIMARY KEY, product_id uuid REFERENCES public.products(id), stripe_price_id text, amount_cents integer, currency text, interval text, active boolean);
    INSERT INTO auth.users(id) VALUES ('${a}'), ('${b}');
    INSERT INTO public.products VALUES ('${price}', true);
    INSERT INTO public.prices VALUES ('${price}', '${price}', 'price_fixture', 1000, 'brl', NULL, true), ('${price2}', '${price}', 'price_other', 500, 'brl', 'month', true);`)
  for (const name of ['20261003000000_stripe_connect_access.sql', '20261003000001_stripe_checkout_access.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8'))
  }
  await db.query('SELECT * FROM public.reserve_stripe_connection($1)', [a])
  await db.query('SELECT * FROM public.claim_stripe_connection($1)', [a])
  await db.query("UPDATE public.stripe_connected_accounts SET creation_state = 'BOUND', stripe_account_id = 'acct_fixture' WHERE user_id = $1", [a])
  order = (await db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [a, price, key])).rows[0]
  await db.query('SELECT * FROM public.claim_stripe_checkout($1,$2)', [a, order.id])
  await db.query("UPDATE public.stripe_checkout_requests SET creation_state = 'BOUND', stripe_session_id = 'cs_test_fixture', checkout_url = 'https://checkout.stripe.com/c/pay/fixture', expires_at = 9999999999 WHERE id = $1", [order.id])
})
after(() => db.close())
async function as(role, user, action) {
  await db.exec('BEGIN')
  try {
    if (role) await db.exec(`SET LOCAL ROLE ${role}`)
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [user ?? ''])
    return await action()
  } finally { await db.exec('ROLLBACK') }
}
const code = value => error => error.code === value
const event = (overrides = {}) => {
  const p = { event: 'evt_fixture', hash: 'a'.repeat(64), order: order.id, user: a, session: 'cs_test_fixture', amount: 1000, currency: 'brl', state: 'paid', ...overrides }
  return db.query('SELECT public.record_stripe_checkout_event($1,$2,$3,$4,$5,$6,$7,$8) AS duplicate', Object.values(p))
}
test('both migrations preserve prior tables and force RLS', async () => {
  assert.equal((await db.query('SELECT * FROM public.legacy_sentinel')).rows[0].label, 'preserve-existing-schema')
  const rows = (await db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('stripe_connected_accounts','stripe_connect_events','stripe_checkout_requests','stripe_checkout_events')")).rows
  assert.equal(rows.length, 4); assert.ok(rows.every(row => row.relrowsecurity && row.relforcerowsecurity))
})
test('owners see only their checkout and seller; anonymous reads are denied', async () => {
  for (const [user, expected] of [[a, 1], [b, 0], [null, 0]]) await as('authenticated', user, async () => {
    assert.equal((await db.query('SELECT id FROM public.stripe_checkout_requests')).rows.length, expected)
    assert.equal((await db.query('SELECT user_id FROM public.stripe_connected_accounts')).rows.length, expected)
  })
  await assert.rejects(as('anon', a, () => db.query('SELECT id FROM public.stripe_checkout_requests')), code('42501'))
})
test('browser cannot reserve, claim, mark paid, change ownership or read redirect URLs', async () => {
  for (const query of [() => db.query('SELECT public.reserve_stripe_connection($1)', [a]), () => db.query('SELECT public.claim_stripe_connection($1)', [a]),
    () => db.query('SELECT public.reserve_stripe_checkout($1,$2,$3)', [a, price, key]), () => db.query('SELECT public.claim_stripe_checkout($1,$2)', [a, order.id]),
    () => db.query("UPDATE public.stripe_checkout_requests SET payment_state = 'paid'"), () => db.query('SELECT checkout_url FROM public.stripe_checkout_requests'), () => event()]) {
    await assert.rejects(as('authenticated', a, query), code('42501'))
  }
})
test('durable checkout reservation is idempotent and rejects reused keys for another price', async () => {
  await as('service_role', null, async () => {
    const same = (await db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [a, price, key])).rows[0]
    assert.equal(same.id, order.id)
  })
  await assert.rejects(as('service_role', null, () => db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [a, price2, key])), code('23514'))
})
test('another browser reuses the pending checkout instead of duplicating it', async () => {
  await as('service_role', null, async () => {
    const reused = (await db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [a, price, randomUUID()])).rows[0]
    assert.equal(reused.id, order.id)
  })
})
test('claim is atomic, owner-scoped and cannot reacquire a bound checkout', async () => {
  await as('service_role', null, async () => {
    const record = (await db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [b, price, randomUUID()])).rows[0]
    assert.equal((await db.query('SELECT * FROM public.claim_stripe_checkout($1,$2)', [a, record.id])).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM public.claim_stripe_checkout($1,$2)', [b, record.id])).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM public.claim_stripe_checkout($1,$2)', [b, record.id])).rows.length, 0)
  })
})
test('inactive, recurring and wrong-currency prices are unavailable', async () => {
  await assert.rejects(as('service_role', null, () => db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [b, price2, randomUUID()])), code('P0002'))
  for (const assignment of ["active = false", "currency = 'usd'", 'amount_cents = 0']) {
    await assert.rejects(as(null, null, async () => { await db.exec(`UPDATE public.prices SET ${assignment} WHERE id = '${price}'`)
      await db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [b, price, randomUUID()])
    }), code('P0002'))
  }
})
test('paid webhook receipt and payment update commit together and deduplicate', async () => {
  await as('service_role', null, async () => {
    assert.equal((await event()).rows[0].duplicate, false)
    assert.equal((await event()).rows[0].duplicate, true)
    assert.equal((await db.query('SELECT payment_state FROM public.stripe_checkout_requests WHERE id = $1', [order.id])).rows[0].payment_state, 'paid')
    await event({ event: 'evt_late', hash: 'b'.repeat(64), state: 'expired' })
    assert.equal((await db.query('SELECT payment_state FROM public.stripe_checkout_requests WHERE id = $1', [order.id])).rows[0].payment_state, 'paid')
  })
})
test('webhook mismatch never stores a receipt or changes payment', async () => {
  for (const mismatch of [{ user: b }, { session: 'cs_test_other' }, { amount: 1 }, { currency: 'usd' }, { state: 'invented' }]) {
    await assert.rejects(as('service_role', null, () => event(mismatch)), code('23514'))
    assert.equal((await db.query('SELECT id FROM public.stripe_checkout_events')).rows.length, 0)
  }
})
test('same event identity with altered content is rejected transactionally', async () => {
  await assert.rejects(as('service_role', null, async () => { await event(); await event({ hash: 'b'.repeat(64) }) }), code('23514'))
  assert.equal((await db.query('SELECT id FROM public.stripe_checkout_events')).rows.length, 0)
})
test('trusted backend cannot mutate bound destinations, amounts or paid state', async () => {
  for (const change of ["user_id = '" + b + "'", 'amount_cents = 1', "checkout_url = 'https://evil.test'", "stripe_session_id = 'cs_test_other'", "creation_state = 'RESERVED'"]) {
    await assert.rejects(as('service_role', null, () => db.exec(`UPDATE public.stripe_checkout_requests SET ${change} WHERE id = '${order.id}'`)), code('23514'))
  }
  await assert.rejects(as('service_role', null, async () => { await event(); await db.exec(`UPDATE public.stripe_checkout_requests SET payment_state = 'pending' WHERE id = '${order.id}'`) }), code('23514'))
})
test('receipt history cannot be modified or deleted', async () => {
  for (const sql of ['DELETE FROM public.stripe_checkout_events', "UPDATE public.stripe_checkout_events SET fingerprint = repeat('b',64)"]) {
    await assert.rejects(as(null, null, async () => { await event(); await db.exec(sql) }), code('23514'))
  }
})
test('seller account identity is immutable and one user has only one claim', async () => {
  await assert.rejects(as('service_role', null, () => db.exec("UPDATE public.stripe_connected_accounts SET stripe_account_id = 'acct_other'")), code('23514'))
  await as('service_role', null, async () => {
    await db.query('SELECT * FROM public.reserve_stripe_connection($1)', [b])
    assert.equal((await db.query('SELECT * FROM public.claim_stripe_connection($1)', [b])).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM public.claim_stripe_connection($1)', [b])).rows.length, 0)
  })
})
test('seller event deduplicates without approving KYC locally', async () => {
  await as('service_role', null, async () => {
    for (const expected of [false, true]) assert.equal((await db.query("SELECT public.record_stripe_connect_event('evt_seller','acct_fixture',$1,123) AS duplicate", ['a'.repeat(64)])).rows[0].duplicate, expected)
    assert.equal((await db.query('SELECT creation_state FROM public.stripe_connected_accounts WHERE user_id = $1', [a])).rows[0].creation_state, 'BOUND')
  })
})
test('per-user daily checkout budget rejects a sixth request', async () => {
  await assert.rejects(as('service_role', null, async () => {
    for (let i = 0; i < 6; i++) {
      const record = (await db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [b, price, randomUUID()])).rows[0]
      await db.query("UPDATE public.stripe_checkout_requests SET payment_state = 'expired' WHERE id = $1", [record.id])
    }
  }), code('P0001'))
})
