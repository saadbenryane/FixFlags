import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseEmailBudget, reserveVerificationEmail } from './email-budget.mjs'

describe('controlled verification email budget', () => {
  it('starts closed and rejects unbounded or invalid allocations', () => {
    assert.equal(parseEmailBudget(undefined), 0)
    assert.equal(parseEmailBudget('5'), 5)
    for (const value of ['6', '100', '-1', '1.5', 'false']) assert.throws(() => parseEmailBudget(value))
  })
  it('does not contact persistence or a provider with a closed budget', async () => {
    assert.equal(await reserveVerificationEmail({ $queryRaw() { throw new Error('Unexpected reservation') } }, 0), false)
  })
  it('reserves atomically and refuses concurrent work after the durable allocation is spent', async () => {
    let used = 0
    const db = { async $queryRaw(strings, limit) { return used < limit ? [{ used: ++used }] : [] } }
    const results = await Promise.all(Array.from({ length: 10 }, () => reserveVerificationEmail(db, 5)))
    assert.equal(results.filter(Boolean).length, 5)
    assert.equal(used, 5)
    assert.equal(await reserveVerificationEmail(db, 5), false)
  })
})
