import assert from 'node:assert/strict'
import test from 'node:test'
import { safeAuthNextPath } from './redirect'

test('keeps internal OAuth destinations and their query/hash', () => {
  assert.equal(safeAuthNextPath('/dashboard/reports?range=month#summary'), '/dashboard/reports?range=month#summary')
})

test('falls back for external and protocol-relative OAuth destinations', () => {
  assert.equal(safeAuthNextPath('https://attacker.example/path'), '/dashboard')
  assert.equal(safeAuthNextPath('//attacker.example/path'), '/dashboard')
  assert.equal(safeAuthNextPath('\\\\attacker.example/path'), '/dashboard')
})

test('falls back for absent or non-URL input', () => {
  assert.equal(safeAuthNextPath(null), '/dashboard')
  assert.equal(safeAuthNextPath('javascript:alert(1)'), '/dashboard')
  assert.equal(safeAuthNextPath('/sign-in', '/home'), '/sign-in')
})
