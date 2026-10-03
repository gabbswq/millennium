import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { openTestDatabase, applyMigrations, validateDatabaseTarget } from './test-database.mjs'

let db, migrations, reproducedRecursion = false
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002'
const price = '10000000-0000-4000-8000-000000000001', price2 = '10000000-0000-4000-8000-000000000002'
const key = '20000000-0000-4000-8000-000000000001'
let order
before(async () => {
  db = await openTestDatabase()
  migrations = await applyMigrations(db, { beforeHardening: async () => {
    await assert.rejects(as('authenticated', a, () => db.query('SELECT id FROM public.users')), code('42P17'))
    await db.exec('GRANT UPDATE (role, email, id) ON public.users TO authenticated')
    reproducedRecursion = true
  } })
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${a}', 'a@fixture.test'), ('${b}', 'b@fixture.test');
    INSERT INTO public.products(id,title,slug,product_type,access_type) VALUES
      ('${price}', 'Fixture', 'fixture', 'course', 'one_time'), ('${price2}', 'Monthly fixture', 'monthly-fixture', 'membership', 'subscription');
    INSERT INTO public.prices(id,product_id,stripe_price_id,amount_cents,currency,interval) VALUES
      ('${price}', '${price}', 'price_fixture', 1000, 'brl', NULL), ('${price2}', '${price2}', 'price_other', 500, 'brl', 'month');`)
  await db.query('SELECT * FROM public.reserve_stripe_connection($1)', [a])
  await db.query('SELECT * FROM public.claim_stripe_connection($1)', [a])
  await db.query("UPDATE public.stripe_connected_accounts SET creation_state = 'BOUND', stripe_account_id = 'acct_fixture' WHERE user_id = $1", [a])
  order = (await db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [a, price, key])).rows[0]
  await db.query('SELECT * FROM public.claim_stripe_checkout($1,$2)', [a, order.id])
  await db.query("UPDATE public.stripe_checkout_requests SET creation_state = 'BOUND', stripe_session_id = 'cs_test_fixture', checkout_url = 'https://checkout.stripe.com/c/pay/fixture', expires_at = 9999999999 WHERE id = $1", [order.id])
})
after(async () => { if (db) await db.close() })
async function as(role, user, action) {
  assert.ok([null, 'anon', 'authenticated', 'service_role'].includes(role))
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

test('full historical migration chain reproduces and repairs recursive user RLS', async () => {
  assert.equal(reproducedRecursion, true)
  assert.equal(migrations.length, 10)
  for (const user of [a, b]) await as('authenticated', user, async () => {
    assert.deepEqual((await db.query('SELECT id FROM public.users')).rows, [{ id: user }])
  })
})

test('SQL harness rejects remote, system and query-overridden database targets', () => {
  for (const url of ['not-a-url', 'postgres://remote.test/millennium_test_payments',
    'postgres://localhost/postgres', 'postgres://localhost/millennium_test_payments?host=remote.test',
    'postgres://localhost/millennium_test_payments#fragment']) assert.throws(() => validateDatabaseTarget(url))
  validateDatabaseTarget('postgresql://localhost/millennium_test_payments')
})

test('new auth signup ignores role metadata and provisions a private profile', async () => {
  await as(null, null, async () => {
    const id = randomUUID()
    await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,$2,$3)",
      [id, `${id}@fixture.test`, { role: 'admin', full_name: 'Fixture user' }])
    assert.deepEqual((await db.query('SELECT role,display_name FROM public.users WHERE id = $1', [id])).rows,
      [{ role: 'user', display_name: 'Fixture user' }])
  })
})

test('safe profile updates work without recursion and cannot affect another user', async () => {
  await as('authenticated', a, async () => {
    const { rows } = await db.query("UPDATE public.users SET display_name = 'Changed', metadata = '{\"role\":\"admin\"}' WHERE id = $1 RETURNING role", [a])
    assert.deepEqual(rows, [{ role: 'user' }])
    assert.equal((await db.query('SELECT public.is_admin() AS admin')).rows[0].admin, false)
    assert.equal((await db.query("UPDATE public.users SET display_name = 'Forbidden' WHERE id = $1 RETURNING id", [b])).rows.length, 0)
  })
})

test('even previously granted column privileges cannot change identity, email or role', async () => {
  for (const assignment of ["role = 'admin'", "email = 'other@fixture.test'", `id = '${b}'`, 'created_at = now()', 'updated_at = now()']) {
    await assert.rejects(as('authenticated', a, () => db.exec(`UPDATE public.users SET ${assignment} WHERE id = '${a}'`)), code('42501'))
  }
  await assert.rejects(as('authenticated', a, () => db.exec(`DELETE FROM public.users WHERE id = '${a}'`)), code('42501'))
})

test('service-provisioned admins can read and manage catalog but cannot self-change their role', async () => {
  await as(null, null, async () => {
    await db.query("UPDATE public.users SET role = 'admin' WHERE id = $1", [a])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [a])
    assert.equal((await db.query('SELECT id FROM public.users')).rows.length, 2)
    assert.equal((await db.query('SELECT public.is_admin() AS admin')).rows[0].admin, true)
    assert.equal((await db.query('UPDATE public.products SET active = false WHERE id = $1 RETURNING id', [price])).rows.length, 1)
  })
  await assert.rejects(as(null, null, async () => {
    await db.query("UPDATE public.users SET role = 'admin' WHERE id = $1", [a])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [a])
    await db.query("UPDATE public.users SET role = 'user' WHERE id = $1", [a])
  }), code('42501'))
})

test('anonymous users cannot list profiles and invoker views remain owner-scoped', async () => {
  for (const relation of ['users', 'auth_providers', 'password_reset_tokens', 'public_user_profiles', 'authors']) {
    await assert.rejects(as('anon', null, () => db.exec(`SELECT * FROM public.${relation}`)), code('42501'))
  }
  await as('authenticated', a, async () => {
    assert.deepEqual((await db.query('SELECT id FROM public.public_user_profiles')).rows, [{ id: a }])
  })
})

test('OAuth provider records and reset hashes cannot be manufactured by browser roles', async () => {
  await assert.rejects(as('authenticated', a, () => db.query("INSERT INTO public.auth_providers(user_id,provider,provider_user_id) VALUES ($1,'discord','forged')", [a])), code('42501'))
  await assert.rejects(as('authenticated', a, () => db.query('DELETE FROM public.auth_providers')), code('42501'))
  await assert.rejects(as('authenticated', a, () => db.query('SELECT token FROM public.password_reset_tokens')), code('42501'))
  await as('service_role', null, async () => {
    await db.query("INSERT INTO public.auth_providers(user_id,provider,provider_user_id) VALUES ($1,'discord','fixture')", [a])
  })
})

test('catalog is readable but a normal buyer cannot edit prices or inactive products', async () => {
  await as('anon', null, async () => assert.equal((await db.query('SELECT id FROM public.prices')).rows.length, 2))
  await as('authenticated', a, async () => {
    assert.equal((await db.query('UPDATE public.prices SET amount_cents = 1 RETURNING id')).rows.length, 0)
    assert.equal((await db.query('UPDATE public.products SET active = false RETURNING id')).rows.length, 0)
  })
  await as(null, null, async () => {
    await db.query('UPDATE public.products SET active = false WHERE id = $1', [price])
    await db.exec('SET LOCAL ROLE anon')
    assert.equal((await db.query('SELECT id FROM public.products WHERE id = $1', [price])).rows.length, 0)
  })
})

test('legacy orders cannot be inserted or paid by the buyer and raw events stay private', async () => {
  for (const statement of ["UPDATE public.orders SET status = 'completed'", 'DELETE FROM public.orders',
    'INSERT INTO public.orders DEFAULT VALUES', 'SELECT raw_event FROM public.payments']) {
    await assert.rejects(as('authenticated', a, () => db.exec(statement)), code('42501'))
  }
  await as('authenticated', a, async () => {
    assert.equal((await db.query('SELECT public.can_access_product($1) AS allowed', [price])).rows[0].allowed, false)
  })
  // The new test Checkout intentionally does not fulfill legacy content.
  await as('service_role', a, async () => {
    await event()
    assert.equal((await db.query('SELECT public.can_access_product($1) AS allowed', [price])).rows[0].allowed, false)
  })
})

test('public clients cannot invoke expensive refresh or publishing jobs', async () => {
  for (const role of ['anon', 'authenticated']) for (const statement of [
    'SELECT public.refresh_featured_articles()', 'SELECT public.publish_scheduled_articles()',
    `SELECT public.publish_article('${price}')`, `SELECT public.unpublish_article('${price}')`]) {
    await assert.rejects(as(role, a, () => db.exec(statement)), code('42501'))
  }
  await as('service_role', null, async () => {
    assert.equal((await db.query('SELECT * FROM public.publish_scheduled_articles()')).rows.length, 0)
    await db.query('SELECT public.refresh_featured_articles()')
  })
})

test('public article listing remains readable after permission hardening', async () => {
  await as(null, null, async () => {
    const id = randomUUID()
    await db.query("INSERT INTO public.articles(id,title,slug,author_id,status,published_at) VALUES ($1,'Fixture','fixture-article',$2,'published',now())", [id, a])
    await db.query("INSERT INTO public.tags(id,name,slug) VALUES ($1,'Fixture','fixture-tag')", [id])
    await db.query('INSERT INTO public.article_tags(article_id,tag_id) VALUES ($1,$1)', [id])
    await db.exec('SET LOCAL ROLE anon')
    const { rows } = await db.query('SELECT id,tags FROM public.public_articles')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].tags[0].name, 'Fixture')
  })
})

test('authenticated clients cannot inject objects into the public search path', async () => {
  await assert.rejects(as('authenticated', a, () => db.exec('CREATE TABLE public.hijack (id int)')), code('42501'))
})

// Separate connections are essential: PGlite serializes queries in one session.
async function concurrent(count, action) {
  const clients = await Promise.all(Array.from({ length: count }, () => db.connect()))
  try {
    for (const client of clients) await client.exec('SET ROLE service_role')
    return await Promise.allSettled(clients.map((client, index) => action(client, index)))
  } finally { await Promise.all(clients.map(client => client.close())) }
}
async function newUsers(count) {
  const users = Array.from({ length: count }, () => randomUUID())
  for (const id of users) await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [id, `${id}@fixture.test`])
  return users
}
const nativeOnly = { skip: !process.env.MILLENNIUM_TEST_DATABASE_URL, timeout: 30000 }

test('native PostgreSQL: simultaneous checkout reservations reuse one durable identity', nativeOnly, async () => {
  const [user] = await newUsers(1)
  const results = await concurrent(8, client => client.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [user, price, randomUUID()]))
  assert.ok(results.every(result => result.status === 'fulfilled'))
  assert.equal(new Set(results.map(result => result.value.rows[0].id)).size, 1)
  const id = results[0].value.rows[0].id
  const claims = await concurrent(8, client => client.query('SELECT * FROM public.claim_stripe_checkout($1,$2)', [user, id]))
  assert.ok(claims.every(result => result.status === 'fulfilled'))
  assert.equal(claims.reduce((sum, result) => sum + result.value.rows.length, 0), 1)
})

test('native PostgreSQL: simultaneous seller claims create only one account reservation', nativeOnly, async () => {
  const [user] = await newUsers(1)
  const results = await concurrent(8, client => client.query('SELECT * FROM public.reserve_stripe_connection($1)', [user]))
  assert.ok(results.every(result => result.status === 'fulfilled'))
  assert.equal(new Set(results.map(result => result.value.rows[0].request_id)).size, 1)
  const claims = await concurrent(8, client => client.query('SELECT * FROM public.claim_stripe_connection($1)', [user]))
  assert.ok(claims.every(result => result.status === 'fulfilled'))
  assert.equal(claims.reduce((sum, result) => sum + result.value.rows.length, 0), 1)
})

test('native PostgreSQL: simultaneous webhook redelivery produces one receipt and payment', nativeOnly, async () => {
  const results = await concurrent(8, client => client.query('SELECT public.record_stripe_checkout_event($1,$2,$3,$4,$5,$6,$7,$8) AS duplicate',
    ['evt_concurrent', 'c'.repeat(64), order.id, a, 'cs_test_fixture', 1000, 'brl', 'paid']))
  assert.ok(results.every(result => result.status === 'fulfilled'))
  assert.equal(results.filter(result => !result.value.rows[0].duplicate).length, 1)
  assert.equal((await db.query("SELECT id FROM public.stripe_checkout_events WHERE id = 'evt_concurrent'")).rows.length, 1)
})

test('native PostgreSQL: concurrent sellers cannot exceed the global daily reservation limit', nativeOnly, async () => {
  const existing = Number((await db.query('SELECT count(*) AS total FROM public.stripe_connected_accounts')).rows[0].total)
  const fillers = await newUsers(24 - existing)
  for (const user of fillers) await db.query('SELECT * FROM public.reserve_stripe_connection($1)', [user])
  const users = await newUsers(8)
  const results = await concurrent(8, (client, index) => client.query('SELECT * FROM public.reserve_stripe_connection($1)', [users[index]]))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.code === 'P0001'))
  assert.equal(Number((await db.query('SELECT count(*) AS total FROM public.stripe_connected_accounts')).rows[0].total), 25)
})

test('native PostgreSQL: concurrent buyers cannot exceed the global daily checkout limit', nativeOnly, async () => {
  const existing = Number((await db.query('SELECT count(*) AS total FROM public.stripe_checkout_requests')).rows[0].total)
  const fillers = await newUsers(99 - existing)
  for (const user of fillers) await db.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [user, price, randomUUID()])
  const users = await newUsers(8)
  const results = await concurrent(8, (client, index) => client.query('SELECT * FROM public.reserve_stripe_checkout($1,$2,$3)', [users[index], price, randomUUID()]))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.code === 'P0001'))
  assert.equal(Number((await db.query('SELECT count(*) AS total FROM public.stripe_checkout_requests')).rows[0].total), 100)
})
