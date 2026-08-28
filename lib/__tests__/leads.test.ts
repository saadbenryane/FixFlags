import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { normalizeDomain } from '../leads/normalize-domain'
import { deriveLeadPotential, formatLeadPotential } from '../leads/qualify'

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

describe('deriveLeadPotential', () => {
  it('returns low for no signup and a single scan', () => {
    assert.equal(deriveLeadPotential({ linkedUserId: null, scanCount: 1 }), 'low')
    assert.equal(deriveLeadPotential({ linkedUserId: undefined, scanCount: 1 }), 'low')
    assert.equal(deriveLeadPotential({ linkedUserId: null, scanCount: 0 }), 'low')
  })

  it('returns medium for no signup and 2+ scans', () => {
    assert.equal(deriveLeadPotential({ linkedUserId: null, scanCount: 2 }), 'medium')
    assert.equal(deriveLeadPotential({ linkedUserId: null, scanCount: 5 }), 'medium')
  })

  it('returns high for signed-up leads with 1+ scans', () => {
    assert.equal(deriveLeadPotential({ linkedUserId: 'user-1', scanCount: 1 }), 'high')
    assert.equal(deriveLeadPotential({ linkedUserId: 'user-1', scanCount: 4 }), 'high')
  })

  it('returns low when signed up but scanCount is 0', () => {
    assert.equal(deriveLeadPotential({ linkedUserId: 'user-1', scanCount: 0 }), 'low')
  })

  it('formats potential labels', () => {
    assert.equal(formatLeadPotential('low'), 'Low')
    assert.equal(formatLeadPotential('medium'), 'Medium')
    assert.equal(formatLeadPotential('high'), 'High')
  })
})
