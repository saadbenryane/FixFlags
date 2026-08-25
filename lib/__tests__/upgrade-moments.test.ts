import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  getUpgradeMomentContent,
  resolveFreeUserUpgradeMoment,
  resolveCompareUpgradeMoment,
} from '@/lib/billing/upgrade-moments'

describe('getUpgradeMomentContent', () => {
  it('returns content for audit_limit_reached', () => {
    const content = getUpgradeMomentContent('audit_limit_reached')
    assert.ok(content.headline)
    assert.ok(content.body)
    assert.ok(content.cta)
  })

  it('returns content for compare_improved with score delta', () => {
    const content = getUpgradeMomentContent('compare_improved', { scoreDelta: 15 })
    assert.ok(content.headline)
    assert.ok(content.cta)
  })

  it('returns content for compare_flat', () => {
    const content = getUpgradeMomentContent('compare_flat')
    assert.ok(content.headline)
  })

  it('returns content for free_default', () => {
    const content = getUpgradeMomentContent('free_default')
    assert.ok(content.headline)
    assert.ok(content.body)
  })
})

describe('resolveFreeUserUpgradeMoment', () => {
  it('returns audit_limit_reached when at limit', () => {
    assert.equal(resolveFreeUserUpgradeMoment({ atAuditLimit: true }), 'audit_limit_reached')
  })

  it('returns free_default when not at limit', () => {
    assert.equal(resolveFreeUserUpgradeMoment({ atAuditLimit: false }), 'free_default')
  })
})

describe('resolveCompareUpgradeMoment', () => {
  it('returns compare_improved when afterScore > beforeScore', () => {
    assert.equal(resolveCompareUpgradeMoment(50, 75), 'compare_improved')
  })

  it('returns compare_flat when afterScore <= beforeScore', () => {
    assert.equal(resolveCompareUpgradeMoment(75, 50), 'compare_flat')
    assert.equal(resolveCompareUpgradeMoment(50, 50), 'compare_flat')
  })

  it('returns compare_flat when either score is null', () => {
    assert.equal(resolveCompareUpgradeMoment(null, 75), 'compare_flat')
    assert.equal(resolveCompareUpgradeMoment(50, null), 'compare_flat')
    assert.equal(resolveCompareUpgradeMoment(null, null), 'compare_flat')
  })
})
