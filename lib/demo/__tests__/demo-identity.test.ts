import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { DEMO_BRAND } from '@/lib/demo/brand'
import { originalFixture } from '@/lib/demo/fixtures/original'
import { v1Fixture } from '@/lib/demo/fixtures/v1'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { DEMO_FIXTURE_CONTEXT_TAG } from '@/lib/marketing/display-meta'
import { SEO } from '@/lib/marketing/copy'

/**
 * The demo has one name and one story. Chrome, fixture copy, curated evidence,
 * and SEO must agree, or visitors see three products in one screenshot.
 */
const RETIRED_IDENTITIES = /plantdad|rooted|plant care|succulent/i

function fixtureText(fixture: typeof originalFixture): string {
  return JSON.stringify(fixture)
}

describe('demo identity', () => {
  it('names the demo product Launchpad at fixflags.com/demo', () => {
    assert.equal(DEMO_BRAND.name, 'Launchpad')
    assert.equal(DEMO_BRAND.domainLabel, 'fixflags.com/demo')
    assert.equal(DEMO_BRAND.displayLabel, 'Launchpad demo')
    assert.equal(DEMO_FIXTURE_CONTEXT_TAG, 'Launchpad demo fixture')
  })

  it('carries no retired identity in either fixture', () => {
    assert.ok(!RETIRED_IDENTITIES.test(fixtureText(originalFixture)))
    assert.ok(!RETIRED_IDENTITIES.test(fixtureText(v1Fixture)))
  })

  it('keeps every intentional defect in the original fixture', () => {
    assert.equal(originalFixture.layout.ctaAboveFoldMobile, false)
    assert.equal(originalFixture.layout.largeHeroImageMobile, true)
    assert.equal(originalFixture.layout.showAnnouncement, true)
    assert.equal(originalFixture.layout.slowSignupDestination, true)
    assert.equal(originalFixture.layout.brokenScrollReveal, true)
    assert.equal(originalFixture.layout.simulateSlowBundle, true)
    assert.equal(originalFixture.metadata.description, '')
    assert.deepEqual(originalFixture.metadata.openGraph?.images, [])
  })

  it('quotes the Launchpad copy in the curated sample evidence', () => {
    const sample = getStaticSampleAudit()
    const messageFlag = sample.flags.find((flag) => flag.checkId === 'h1-generic')

    assert.ok(messageFlag)
    assert.ok(messageFlag.evidence?.includes(originalFixture.headline))
    assert.ok(!RETIRED_IDENTITIES.test(JSON.stringify(sample)))
  })

  it('describes the Launchpad demo in samples SEO', () => {
    assert.match(SEO.samples.description, /Launchpad demo/i)
    assert.ok(!RETIRED_IDENTITIES.test(SEO.samples.description))
  })
})
