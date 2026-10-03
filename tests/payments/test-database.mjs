import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import pg from 'pg'

export function validateDatabaseTarget(connectionString) {
  let target
  try { target = new URL(connectionString) } catch { throw new Error('Invalid SQL test target.') }
  if (!['postgres:', 'postgresql:'].includes(target.protocol)
    || !['127.0.0.1', 'localhost'].includes(target.hostname)
    || !/^\/millennium_test_[a-z0-9_]+$/.test(target.pathname) || target.search || target.hash) {
    throw new Error('SQL tests require a dedicated loopback millennium_test_* database.')
  }
}

export async function openTestDatabase() {
  const connectionString = process.env.MILLENNIUM_TEST_DATABASE_URL
  let db
  if (connectionString) {
    validateDatabaseTarget(connectionString)
    const connect = async () => {
      const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000,
        statement_timeout: 10000, application_name: 'millennium-sql-tests' })
      try { await client.connect() } catch {
        await client.end().catch(() => {})
        throw new Error('Could not connect to the dedicated SQL test database.')
      }
      return { query: (sql, params) => client.query(sql, params), exec: sql => client.query(sql), close: () => client.end() }
    }
    db = { ...await connect(), connect }
  } else {
    db = new PGlite({ extensions: { unaccent } })
  }
  try {
    const { rows } = await db.query(`SELECT
      EXISTS (SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public', 'information_schema') AND nspname !~ '^pg_') AS schemas,
      EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace) AS objects,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) AS roles`)
    if (Object.values(rows[0]).some(Boolean)) throw new Error('Test database is not empty. Nothing was overwritten.')
    await db.exec(await readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8'))
    return db
  } catch (error) {
    await db.close()
    throw error
  }
}

export async function applyMigrations(db, { beforeHardening } = {}) {
  const directory = new URL('../../supabase/migrations/', import.meta.url)
  const names = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()
  for (const name of names) {
    if (name === '20261003000002_auth_access_hardening.sql') await beforeHardening?.()
    await db.exec(await readFile(new URL(name, directory), 'utf8'))
  }
  return names
}
