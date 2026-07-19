import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  DEFAULT_SAMPLE_AUDIT_URL,
  DEMO_FIXTURE_CONTEXT_TAG,
  DOGFOOD_CONTEXT_TAG,
  getSampleSiteDisplay,
  sampleStatusLabel,
} from '@/lib/marketing/display-meta'
import { DEMO_BRAND } from '@/lib/demo/brand'

describe('getSampleSiteDisplay', () => {
  it('labels fixflags.com/demo as CloudNap demo fixture', () => {
    const site = getSampleSiteDisplay(DEFAULT_SAMPLE_AUDIT_URL)
    assert.equal(site.displayHost, DEMO_BRAND.displayLabel)
    assert.equal(site.contextTag, DEMO_FIXTURE_CONTEXT_TAG)
    assert.equal(site.isDemoFixture, true)
    assert.equal(site.isDogfood, false)
  })

  it('labels fixflags.com homepage as dogfood', () => {
    const site = getSampleSiteDisplay('https://fixflags.com/')
    assert.equal(site.isDogfood, true)
    assert.equal(site.isDemoFixture, false)
    assert.equal(site.displayHost, DOGFOOD_CONTEXT_TAG)
  })

  it('labels third-party URLs by hostname', () => {
    const site = getSampleSiteDisplay('https://stripe.com/pricing')
    assert.equal(site.displayHost, 'stripe.com')
    assert.equal(site.isDogfood, false)
    assert.equal(site.isDemoFixture, false)
  })

  it('falls back to demo fixture on malformed URL', () => {
    const site = getSampleSiteDisplay('not-a-url')
    assert.equal(site.isDemoFixture, true)
    assert.equal(site.displayHost, DEMO_BRAND.displayLabel)
  })
})

describe('sampleStatusLabel', () => {
  it('uses demo fixture context on marketing pages', () => {
    const label = sampleStatusLabel('live', {
      marketing: true,
      isDemoFixture: true,
      version: '2.1.0',
      completedAt: new Date('2026-06-20T12:00:00Z'),
    })
    assert.match(label, /LaunchPad demo fixture/)
    assert.match(label, /Pipeline v2\.1\.0/)
    assert.match(label, /Jun 20, 2026/)
  })
})
