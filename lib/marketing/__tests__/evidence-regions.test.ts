import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  anchorToRegion,
  evidenceScopeForCheck,
  formatVisualEvidence,
  visualTargetLabel,
} from '@/lib/marketing/evidence-regions'
import { devicesForCheck, getEvidenceSelectors } from '@/lib/marketing/evidence-selectors'

describe('evidence-regions', () => {
  it('uses page scope for metadata checks', () => {
    assert.equal(evidenceScopeForCheck('description-missing'), 'page')
    assert.equal(evidenceScopeForCheck('og-image-missing'), 'page')
    const region = anchorToRegion('description-missing', { x: 0.5, y: 0.3 })
    assert.equal(region.scope, 'page')
    assert.ok(region.width > 0.9)
  })

  it('uses element scope for hero headline checks', () => {
    assert.equal(evidenceScopeForCheck('h1-generic'), 'element')
    const region = anchorToRegion('h1-generic', { x: 0.28, y: 0.31 })
    assert.equal(region.scope, 'element')
    assert.ok(region.width < 0.9)
    assert.ok(region.height < 0.2)
  })

  it('formats evidence with a visual target prefix', () => {
    const text = formatVisualEvidence(
      'h1-generic',
      'Headline reads a category label, not an outcome.'
    )
    assert.match(text, /Hero headline/i)
    assert.match(text, /Headline reads/)
  })

  it('exposes human labels for common checks', () => {
    assert.match(visualTargetLabel('cta-below-fold-mobile'), /call-to-action/i)
    assert.match(visualTargetLabel('og-image-missing'), /whole page/i)
  })

  it('targets slow loading states as visible element evidence', () => {
    assert.equal(evidenceScopeForCheck('loading-state-slow'), 'element')
    assert.deepEqual(devicesForCheck('loading-state-slow'), ['desktop', 'mobile'])
    assert.ok(getEvidenceSelectors('loading-state-slow')?.selectors.includes('[aria-busy="true"]'))

    const region = anchorToRegion('loading-state-slow', { x: 0.5, y: 0.35 })
    assert.equal(region.scope, 'element')
    assert.ok(region.height > 0.15)
    assert.match(visualTargetLabel('loading-state-slow'), /loading/i)
  })

  it('keeps mobile-only checks on mobile (no healthy desktop twin)', () => {
    assert.deepEqual(devicesForCheck('cta-below-fold-mobile'), ['mobile'])
    assert.deepEqual(devicesForCheck('mobile-cta-thumb-zone'), ['mobile'])
    assert.deepEqual(devicesForCheck('unknown-mobile-issue'), ['mobile'])
    assert.deepEqual(devicesForCheck('unknown-check-xyz'), ['desktop'])
  })
})
