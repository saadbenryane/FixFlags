import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDomain } from '../leads/normalize-domain'
import { shouldAutoQualifyLead } from '../leads/qualify'

describe('normalizeDomain', () => {
  it('strips www and lowercases', () => {
    assert.equal(normalizeDomain('https://WWW.Example.com/path'), 'example.com')
  })

  it('accepts bare hostname', () => {
    assert.equal(normalizeDomain('acme.io'), 'acme.io')
  })

  it('returns null for invalid input', () => {
    assert.equal(normalizeDomain(''), null)
    assert.equal(normalizeDomain('not a url!!!'), null)
  })
})

describe('shouldAutoQualifyLead', () => {
  it('qualifies repeat scanners', () => {
    assert.equal(shouldAutoQualifyLead({ status: 'NEW', scanCount: 2, latestScore: 90 }), true)
  })

  it('qualifies low scores', () => {
    assert.equal(shouldAutoQualifyLead({ status: 'NEW', scanCount: 1, latestScore: 55 }), true)
  })

  it('does not change non-new leads', () => {
    assert.equal(shouldAutoQualifyLead({ status: 'CONTACTED', scanCount: 5, latestScore: 40 }), false)
  })
})
