import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

const userA = '00000000-0000-4000-8000-000000000001';
const userB = '00000000-0000-4000-8000-000000000002';
const userC = '00000000-0000-4000-8000-000000000003';
const accountA = '10000000-0000-4000-8000-000000000001';
const accountB = '10000000-0000-4000-8000-000000000002';
const chargeA = '20000000-0000-4000-8000-000000000001';
const chargeB = '20000000-0000-4000-8000-000000000002';
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
let db;

before(async () => {
  const connectionString = process.env.MILLENNIUM_TEST_DATABASE_URL;
  if (connectionString) {
    let target;
    try { target = new URL(connectionString); }
    catch { throw new Error('Invalid dedicated SQL test database URL.'); }
    if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
        !['127.0.0.1', 'localhost'].includes(target.hostname) ||
        !/^\/millennium_test_[a-z0-9_]+$/.test(target.pathname) || target.search || target.hash) {
      throw new Error('SQL integration tests require a dedicated loopback millennium_test_* database.');
    }
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
    try { await client.connect(); }
    catch {
      await client.end().catch(() => {});
      throw new Error('Could not connect to the dedicated SQL test database.');
    }
    db = { query: (sql, params) => client.query(sql, params), exec: sql => client.query(sql), close: () => client.end() };
  } else {
    db = new PGlite();
  }
  const existing = await db.query(`SELECT
    EXISTS (SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public', 'information_schema') AND nspname !~ '^pg_') AS schemas,
    EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace) AS objects,
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) AS roles`);
  if (Object.values(existing.rows[0]).some(Boolean)) throw new Error('Test database is not empty. No schemas were overwritten.');
  await db.exec(`BEGIN; ${await readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8')} COMMIT;`);
  await db.exec(await readFile(new URL('../001_accounts.sql', import.meta.url), 'utf8'));
  await db.query('INSERT INTO auth.users(id) VALUES ($1), ($2), ($3)', [userA, userB, userC]);
  await db.query('INSERT INTO millennium_payments.accounts(id, owner_id, name) VALUES ($1, $2, $3), ($4, $5, $6)',
    [accountA, userA, 'Loja ficticia A', accountB, userB, 'Loja ficticia B']);
  await insertCharge({ id: chargeA, account_id: accountA, provider_id: 'pay_A' });
  await insertCharge({ id: chargeB, account_id: accountB, provider_id: 'pay_B', request_hash: hashB });
  await insertEvent({ provider_event_id: 'evt_A', charge_id: chargeA });
  await insertEvent({ provider_event_id: 'evt_B', account_id: accountB, charge_id: chargeB });
});
after(async () => { if (db) await db.close(); });

async function as(role, user, operation) {
  assert.ok(['authenticated', 'anon', 'service_role', 'owner'].includes(role));
  await db.exec('BEGIN');
  try {
    if (role !== 'owner') await db.exec(`SET LOCAL ROLE ${role}`);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    return await operation();
  } finally { await db.exec('ROLLBACK'); }
}

async function insertCharge(overrides = {}) {
  const record = { id: randomUUID(), account_id: accountA, provider_account_ref: 'sandbox_fixture',
    provider_customer_id: 'cus_fixture',
    provider_id: null, request_key: `req_${randomUUID()}`, request_hash: hashA,
    description: 'Cobranca ficticia', amount_cents: 1001, due_date: '2030-01-01', status: 'PENDING', ...overrides };
  const columns = Object.keys(record);
  return db.query(`INSERT INTO millennium_payments.charges(${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(record));
}
async function insertEvent(overrides = {}) {
  const record = { account_id: accountA, charge_id: chargeA, provider_account_ref: 'sandbox_fixture',
    provider_event_id: `evt_${randomUUID()}`, event: 'PAYMENT_CREATED', fingerprint: hashA,
    disposition: 'applied', ...overrides };
  const columns = Object.keys(record);
  return db.query(`INSERT INTO millennium_payments.payment_events(${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, Object.values(record));
}
const sqlError = code => error => error.code === code;

test('migration preserves legacy tables and enables forced RLS on every new table', async () => {
  assert.deepEqual((await db.query('SELECT * FROM public.legacy_sentinel')).rows, [{ label: 'preserve-existing-schema' }]);
  const result = await db.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace = 'millennium_payments'::regnamespace AND relkind = 'r' ORDER BY relname");
  assert.equal(result.rows.length, 3);
  assert.ok(result.rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
});

test('each authenticated user sees only their own account, charge and event', async () => {
  for (const [user, account, charge, event] of [[userA, accountA, chargeA, 'evt_A'], [userB, accountB, chargeB, 'evt_B']]) {
    await as('authenticated', user, async () => {
      assert.deepEqual((await db.query('SELECT id FROM millennium_payments.accounts')).rows, [{ id: account }]);
      assert.deepEqual((await db.query('SELECT id FROM millennium_payments.charges')).rows, [{ id: charge }]);
      assert.deepEqual((await db.query('SELECT provider_event_id FROM millennium_payments.payment_events')).rows, [{ provider_event_id: event }]);
    });
  }
});

test('guessed charge IDs from another account return no rows', async () => {
  await as('authenticated', userA, async () => {
    assert.equal((await db.query('SELECT id FROM millennium_payments.charges WHERE id = $1', [chargeB])).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM millennium_payments.payment_events WHERE account_id = $1', [accountB])).rows.length, 0);
  });
});

test('missing identity and users with no account see no payment rows', async () => {
  for (const user of [null, userC]) await as('authenticated', user, async () => {
    for (const table of ['accounts', 'charges', 'payment_events']) {
      assert.equal((await db.query(`SELECT id FROM millennium_payments.${table}`)).rows.length, 0);
    }
  });
});

test('anonymous role has no access even when a subject is supplied', async () => {
  for (const table of ['accounts', 'charges', 'payment_events']) {
    await assert.rejects(as('anon', userA, () => db.query(`SELECT id FROM millennium_payments.${table}`)), sqlError('42501'));
  }
});

test('browser cannot create accounts or charges, mark paid, transfer ownership or delete records', async () => {
  for (const operation of [
    () => db.query('INSERT INTO millennium_payments.accounts(owner_id, name) VALUES ($1, $2)', [userA, 'Fake']),
    () => insertCharge(),
    () => db.query("UPDATE millennium_payments.charges SET status = 'RECEIVED' WHERE id = $1", [chargeA]),
    () => db.query('UPDATE millennium_payments.accounts SET owner_id = $1 WHERE id = $2', [userB, accountA]),
    () => db.query('DELETE FROM millennium_payments.charges WHERE id = $1', [chargeA]),
    () => insertEvent(),
  ]) await assert.rejects(as('authenticated', userA, operation), sqlError('42501'));
});

test('browser cannot read internal request hashes, keys or provider account mappings', async () => {
  for (const column of ['request_key', 'request_hash', 'provider_account_ref', 'provider_customer_id']) {
    await assert.rejects(as('authenticated', userA, () => db.query(`SELECT ${column} FROM millennium_payments.charges`)), sqlError('42501'));
  }
  await assert.rejects(as('authenticated', userA, () => db.query('SELECT fingerprint FROM millennium_payments.payment_events')), sqlError('42501'));
});

test('idempotency key is unique within an account, not across different accounts', async () => {
  const key = 'same_request_key_123';
  await as('service_role', null, async () => {
    await insertCharge({ request_key: key });
    await insertCharge({ account_id: accountB, request_key: key });
  });
  await assert.rejects(as('service_role', null, async () => {
    await insertCharge({ request_key: key });
    await insertCharge({ request_key: key });
  }), sqlError('23505'));
});

test('an unresolved request cannot be duplicated with a different key', async () => {
  await assert.rejects(as('service_role', null, async () => {
    await insertCharge({ status: 'UNCERTAIN' });
    await insertCharge({ status: 'CREATING' });
  }), sqlError('23505'));
  await as('service_role', null, async () => {
    await insertCharge({ status: 'UNCERTAIN' });
    await insertCharge({ account_id: accountB, status: 'CREATING' });
  });
});

test('one remote payment cannot be assigned to two accounts in the same provider source', async () => {
  await assert.rejects(as('service_role', null, () => insertCharge({ account_id: accountB, provider_id: 'pay_A' })), sqlError('23505'));
  await as('service_role', null, () => insertCharge({ account_id: accountB, provider_account_ref: 'other_sandbox_fixture', provider_id: 'pay_A' }));
});

test('event deduplication spans accounts sharing the same provider source', async () => {
  await assert.rejects(as('service_role', null, () => insertEvent({ account_id: accountB, charge_id: chargeB, provider_event_id: 'evt_A' })), sqlError('23505'));
});

test('event cannot reference a charge in another account or provider source', async () => {
  for (const change of [{ charge_id: chargeB }, { provider_account_ref: 'other_sandbox_fixture' }]) {
    await assert.rejects(as('service_role', null, () => insertEvent(change)), sqlError('23503'));
  }
  await as('service_role', null, () => insertEvent({ charge_id: null, disposition: 'ignored' }));
  await assert.rejects(as('service_role', null, () => insertEvent({ charge_id: null })), sqlError('23514'));
});

test('constraints reject invalid cents, identity, currency, production and provider', async () => {
  for (const change of [{ amount_cents: 0 }, { amount_cents: -1 }, { amount_cents: 1000001 },
    { request_key: 'short' }, { request_hash: 'not-a-hash' }, { description: ' ' },
    { currency: 'USD' }, { environment: 'production' }, { provider: 'stripe' }, { status: 'FAKE_PAID' }, { provider_customer_id: 'not_a_customer' }]) {
    await assert.rejects(as('service_role', null, () => insertCharge(change)), sqlError('23514'));
  }
  await assert.rejects(as('service_role', null, () => insertCharge({ amount_cents: 100.5 })), sqlError('22P02'));
  await as('service_role', null, () => insertCharge({ amount_cents: 1000000, due_date: '2020-01-01' }));
});

test('original request and established remote identity are immutable', async () => {
  for (const [column, value] of [['account_id', accountB], ['amount_cents', 2000], ['description', 'Modified'],
    ['due_date', '2031-01-01'], ['provider_account_ref', 'other_fixture'], ['provider_customer_id', 'cus_other'], ['provider_id', 'pay_changed']]) {
    await assert.rejects(as('service_role', null, () => db.query(`UPDATE millennium_payments.charges SET ${column} = $1 WHERE id = $2`, [value, chargeA])), sqlError('23514'));
  }
});

test('trusted backend may rename an account but cannot transfer its ownership', async () => {
  await as('service_role', null, async () => {
    await db.query('UPDATE millennium_payments.accounts SET name = $1 WHERE id = $2', ['Novo nome ficticio', accountA]);
    assert.equal((await db.query('SELECT name FROM millennium_payments.accounts WHERE id = $1', [accountA])).rows[0].name, 'Novo nome ficticio');
  });
  await assert.rejects(as('service_role', null, () => db.query('UPDATE millennium_payments.accounts SET owner_id = $1 WHERE id = $2', [userB, accountA])), sqlError('23514'));
});

test('terminal states cannot regress and received may transition only to refunded', async () => {
  await as('service_role', null, async () => {
    await db.query("UPDATE millennium_payments.charges SET status = 'RECEIVED' WHERE id = $1", [chargeA]);
    await db.query("UPDATE millennium_payments.charges SET status = 'REFUNDED' WHERE id = $1", [chargeA]);
    assert.equal((await db.query('SELECT status FROM millennium_payments.charges WHERE id = $1', [chargeA])).rows[0].status, 'REFUNDED');
  });
  for (const [start, end] of [['RECEIVED', 'OVERDUE'], ['RECEIVED', 'CANCELED'], ['REFUNDED', 'RECEIVED'],
    ['CANCELED', 'PENDING'], ['CONFIRMED', 'PENDING'], ['CONFIRMED', 'OVERDUE']]) {
    await assert.rejects(as('service_role', null, async () => {
      await db.query('UPDATE millennium_payments.charges SET status = $1 WHERE id = $2', [start, chargeA]);
      await db.query('UPDATE millennium_payments.charges SET status = $1 WHERE id = $2', [end, chargeA]);
    }), sqlError('23514'));
  }
});

test('even the trusted backend cannot mutate or delete payment event history', async () => {
  for (const sql of ["UPDATE millennium_payments.payment_events SET event = 'CHANGED'", 'DELETE FROM millennium_payments.payment_events']) {
    await assert.rejects(as('service_role', null, () => db.query(sql)), sqlError('42501'));
    await assert.rejects(as('owner', null, () => db.query(sql)), sqlError('23514'));
  }
});

test('failing charge update rolls back the event inserted in the same transaction', async () => {
  await assert.rejects(as('service_role', null, async () => {
    await insertEvent({ provider_event_id: 'evt_rollback' });
    await db.query('UPDATE millennium_payments.charges SET amount_cents = 2000 WHERE id = $1', [chargeA]);
  }), sqlError('23514'));
  assert.equal((await db.query("SELECT id FROM millennium_payments.payment_events WHERE provider_event_id = 'evt_rollback'")).rows.length, 0);
  assert.equal((await db.query('SELECT amount_cents FROM millennium_payments.charges WHERE id = $1', [chargeA])).rows[0].amount_cents, 1001);
});

test('financial references prevent deleting an account or its authentication identity', async () => {
  const restricted = error => ['23001', '23503'].includes(error.code);
  await assert.rejects(as('owner', null, () => db.query('DELETE FROM auth.users WHERE id = $1', [userA])), restricted);
  await assert.rejects(as('owner', null, () => db.query('DELETE FROM millennium_payments.accounts WHERE id = $1', [accountA])), restricted);
  assert.equal((await db.query('SELECT id FROM auth.users WHERE id = $1', [userA])).rows.length, 1);
  assert.equal((await db.query('SELECT id FROM millennium_payments.accounts WHERE id = $1', [accountA])).rows.length, 1);
});
