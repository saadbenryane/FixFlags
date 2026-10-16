import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { ROAST_SEO, SEO } from '@/lib/marketing/copy/seo'
import { LLMS_SECTIONS } from '@/lib/marketing/seo-routes'

const FEATURE_FLAG_INFRA = /feature[- ]flags? infra|openfeature/i

describe('pre-publish brand discovery copy', () => {
  it('keeps FixFlags first on the official homepage snippet', () => {
    assert.match(SEO.home.title, /^FixFlags/)
    assert.match(SEO.home.title, /FixFlags watches/i)
    assert.match(SEO.home.description, /Start with a public URL/ )
    assert.match(SEO.home.description, /meaningful website problems/ )
    assert.match(SEO.home.description, /evidence behind them/ )
    assert.match(SEO.home.description, /Publish the change, then check it again/ )
    assert.doesNotMatch(SEO.home.description, FEATURE_FLAG_INFRA)
  })

  it('names FixFlags on pricing and use-case sitelinks', () => {
    assert.match(SEO.pricing.title, /FixFlags/)
    assert.match(SEO.pricing.description, /open beta/i)
    assert.match(SEO.pricing.description, /one website/i)
    assert.match(SEO.pricing.description, /no usage limits/i)
    assert.match(SEO.waitlist.description, /\$49/)
    assert.match(SEO.waitlist.description, /\$99/)
    assert.match(SEO.pricing.description, /supported monitoring schedule/i)
    assert.doesNotMatch(SEO.pricing.title, /^Pricing$/)
    assert.doesNotMatch(SEO.pricing.description, /24\/7/i)
    assert.doesNotMatch(SEO.pricing.description, /free on shopify/i)
    assert.doesNotMatch(SEO.pricing.description, /\$69|\$199/)

    assert.match(SEO.useCases.title, /FixFlags/)
    assert.match(SEO.useCases.description, /agencies/i)
  })

  it('does not advertise a roast grade or Shopify-only pricing in llms notes', () => {
    assert.doesNotMatch(ROAST_SEO.description, /\bgrade\b/i)
    const productNotes = LLMS_SECTIONS.flatMap((section) => section.links)
      .map((link) => `${link.path} ${link.note ?? ''}`)
      .join('\n')
    assert.match(productNotes, /\/pricing[^\n]*open beta/i)
    assert.doesNotMatch(productNotes, /free on shopify/i)
  })
})
