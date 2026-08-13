import assert from 'node:assert/strict'
import { describe, it, vi, expect } from 'vitest'
import type { Page } from 'playwright'
import {
  discoverJourneyLinks,
  pageHasClearHeadline,
  pageHasPrimaryCta,
  countVisibleFormFields,
  pickTargetForJourney,
  pickNextFunnelTarget,
  pageHasSubstantiveContent,
  pageIsLoading,
  type JourneyLinkCandidate,
} from '../discover'

function fakePage(evaluateResult: unknown): Page {
  return {
    evaluate: vi.fn(async () => evaluateResult),
  } as unknown as Page
}

function link(overrides: Partial<JourneyLinkCandidate>): JourneyLinkCandidate {
  return {
    href: 'https://example.com/pricing',
    text: 'Pricing',
    score: 100,
    category: 'pricing',
    ...overrides,
  }
}

describe('discoverJourneyLinks', () => {
  it('filters, ranks, and deduplicates same-origin CTA links', async () => {
    const page = fakePage([
      { href: '/pricing', text: 'Pricing' },
      { href: '/pricing', text: 'Pricing again' },
      { href: 'mailto:hi@example.com', text: 'Email us' },
      { href: 'https://other-site.com/pricing', text: 'External' },
      { href: '/blog', text: 'Blog' },
      { href: 'javascript:void(0)', text: 'Broken' },
    ])
    const links = await discoverJourneyLinks(page, 'https://example.com')
    const hrefs = links.map((l) => l.href)
    assert.ok(hrefs.includes('https://example.com/pricing'))
    assert.equal(hrefs.filter((h) => h === 'https://example.com/pricing').length, 1)
    assert.ok(!hrefs.some((h) => h.includes('mailto') || h.includes('other-site')))
    // Highest score first
    assert.ok(links.length >= 1)
    expect(links[0].score).toBeGreaterThanOrEqual(links[links.length - 1].score)
  })

  it('returns an empty list for pages without links', async () => {
    const page = fakePage([])
    assert.deepEqual(await discoverJourneyLinks(page, 'https://example.com'), [])
  })
})

describe('page probe helpers', () => {
  it('detects a clear headline from an h1', async () => {
    assert.equal(await pageHasClearHeadline(fakePage(true)), true)
    assert.equal(await pageHasClearHeadline(fakePage(false)), false)
  })

  it('detects a primary CTA and its text', async () => {
    assert.deepEqual(await pageHasPrimaryCta(fakePage({ found: true, text: 'Get started' })), {
      found: true,
      text: 'Get started',
    })
    assert.deepEqual(await pageHasPrimaryCta(fakePage({ found: false, text: null })), {
      found: false,
      text: null,
    })
  })

  it('counts visible form fields', async () => {
    assert.equal(await countVisibleFormFields(fakePage(3)), 3)
    assert.equal(await countVisibleFormFields(fakePage(0)), 0)
  })

  it('checks for substantive content', async () => {
    assert.equal(await pageHasSubstantiveContent(fakePage(true)), true)
    assert.equal(await pageHasSubstantiveContent(fakePage(false)), false)
  })

  it('checks for loading states', async () => {
    assert.equal(await pageIsLoading(fakePage(true)), true)
    assert.equal(await pageIsLoading(fakePage(false)), false)
  })
})

describe('pickTargetForJourney', () => {
  const links = [
    link({ href: 'https://example.com/blog', text: 'Blog', score: 40, category: 'resources' }),
    link({ href: 'https://example.com/pricing', text: 'Pricing', score: 100, category: 'pricing' }),
    link({ href: 'https://example.com/signup', text: 'Sign up', score: 95, category: 'primary-cta' }),
  ]

  it('returns null when there are no links', () => {
    assert.equal(pickTargetForJourney('first-visit', []), null)
  })

  it('prefers pricing for pricing-evaluation', () => {
    const target = pickTargetForJourney('pricing-evaluation', links)
    assert.equal(target?.category, 'pricing')
  })

  it('prefers primary CTA for signup', () => {
    const target = pickTargetForJourney('signup', links)
    assert.equal(target?.category, 'primary-cta')
  })

  it('falls back to the first link for contact-support without contact links', () => {
    const target = pickTargetForJourney('contact-support', links)
    assert.equal(target, links[0])
  })

  it('finds a contact link when present', () => {
    const withContact = [link({ href: 'https://example.com/contact', text: 'Contact us', score: 70, category: 'secondary-cta' })]
    const target = pickTargetForJourney('contact-support', withContact)
    assert.equal(target?.href, 'https://example.com/contact')
  })

  it('prefers the first conversion-matching link for multi-step-funnel', () => {
    const target = pickTargetForJourney('multi-step-funnel', links)
    assert.equal(target?.category, 'pricing')
  })

  it('prefers pricing then primary CTA on first visit', () => {
    const target = pickTargetForJourney('first-visit', links)
    assert.equal(target?.category, 'pricing')
  })
})

describe('pickNextFunnelTarget', () => {
  const links = [
    link({ href: 'https://example.com/pricing', text: 'Pricing' }),
    link({ href: 'https://example.com/signup', text: 'Sign up' }),
  ]

  it('returns null when everything is visited', () => {
    const visited = new Set(['https://example.com/pricing', 'https://example.com/signup'])
    assert.equal(pickNextFunnelTarget(links, visited, ['signup']), null)
  })

  it('prefers goal keyword matches', () => {
    const visited = new Set(['https://example.com/pricing'])
    const target = pickNextFunnelTarget(links, visited, ['sign.?up'])
    assert.equal(target?.href, 'https://example.com/signup')
  })

  it('falls back to the first unvisited link', () => {
    const visited = new Set<string>()
    const target = pickNextFunnelTarget(links, visited, ['unmatched'])
    assert.equal(target?.href, 'https://example.com/pricing')
  })
})
