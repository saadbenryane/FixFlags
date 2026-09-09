import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { SEO } from '@/lib/marketing/copy/seo'
import { LLMS_SECTIONS } from '@/lib/marketing/seo-routes'

const RETIRED_TAGLINE = /finish what your ai started/i
const FEATURE_FLAG_INFRA = /feature[- ]flags? infra|openfeature/i

describe('pre-publish brand discovery copy', () => {
  it('keeps FixFlags first on the official homepage snippet', () => {
    assert.match(SEO.home.title, /^FixFlags/)
    assert.match(SEO.home.title, /looked after/i)
    assert.match(SEO.home.description, /live website/i)
    assert.match(SEO.home.description, /evidence/i)
    assert.match(SEO.home.description, /fix/i)
    assert.doesNotMatch(SEO.home.title, RETIRED_TAGLINE)
    assert.doesNotMatch(SEO.home.description, RETIRED_TAGLINE)
    assert.doesNotMatch(SEO.home.description, FEATURE_FLAG_INFRA)
    assert.doesNotMatch(SEO.home.description, /\bpaste a (live )?url/i)
    assert.doesNotMatch(SEO.home.description, /\bjourneys?\b/i)
  })

  it('names FixFlags on pricing and partners sitelinks', () => {
    assert.match(SEO.pricing.title, /FixFlags/)
    assert.match(SEO.pricing.description, /24\/7 website monitoring/i)
    assert.match(SEO.pricing.description, /\$49/)
    assert.doesNotMatch(SEO.pricing.title, /^Pricing$/)
    assert.doesNotMatch(SEO.pricing.description, /free on shopify/i)
    assert.doesNotMatch(SEO.pricing.description, /\$69|\$199/)

    assert.match(SEO.partners.title, /FixFlags/)
    assert.match(SEO.partners.description, /studios/i)
    assert.doesNotMatch(SEO.partners.title, /^Expert program$/i)
  })

  it('does not advertise a roast grade or Shopify-only pricing in llms notes', () => {
    assert.doesNotMatch(SEO.roast.description, /\bgrade\b/i)
    const productNotes = LLMS_SECTIONS.flatMap((section) => section.links)
      .map((link) => `${link.path} ${link.note ?? ''}`)
      .join('\n')
    assert.match(productNotes, /\/pricing[^\n]*24\/7 monitoring/i)
    assert.doesNotMatch(productNotes, /free on shopify/i)
  })
})
