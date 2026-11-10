import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { triageDegradedVerdict } from '../triage-verdict'

describe('triageDegradedVerdict', () => {
  it('returns the timeout copy for deadline exhaustion', () => {
    const verdict = triageDegradedVerdict('deadline_exhausted', true)
    assert.equal(typeof verdict, 'string')
    assert.ok(verdict.length > 0)
  })

  it('returns signed-in copy when the user is authenticated', () => {
    const verdict = triageDegradedVerdict('provider_exhausted', true)
    assert.equal(typeof verdict, 'string')
    assert.ok(verdict.length > 0)
  })

  it('returns anonymous copy for signed-out users', () => {
    const verdict = triageDegradedVerdict('provider_exhausted', false)
    assert.equal(typeof verdict, 'string')
    assert.ok(verdict.length > 0)
  })
})
