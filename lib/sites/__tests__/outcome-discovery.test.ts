import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => { throw new Error('Outcome discovery must not load persistence') })
vi.mock('@/lib/audit/screenshot', () => { throw new Error('Outcome discovery must use recorded facts') })
import { discoverOutcomePages, discoverJourneyOutcomes } from '../domain/outcome-discovery'

describe('Outcome discovery from recorded facts', () => {
  it('preserves raw page identity and observed titles while excluding external and non-web destinations', () => {
    const source = { pages: [{ url: 'https://example.test/start#original', title: 'Observed starting title' }],
      journeyReviews: [{ journeyType: 'signup', startUrl: 'https://example.test/start#original', steps: [
        { url: 'https://example.test/signup#step' }, { url: 'https://external.test/signup' }, { url: 'mailto:support@example.test' },
      ] }] }
    const original = structuredClone(source)
    expect(discoverOutcomePages('https://example.test/', source)).toEqual([
      { rawUrl: 'https://example.test/start#original', url: 'https://example.test/start#original', path: '/start', title: 'Observed starting title' },
      { rawUrl: 'https://example.test/signup#step', url: 'https://example.test/signup#step', path: '/signup', title: null },
    ])
    expect(source).toEqual(original)
  })
  it('retains separately observed fragment identities without inventing their missing titles', () => {
    expect(discoverOutcomePages('https://example.test/', { pages: [], journeyReviews: [
      { journeyType: 'signup', startUrl: 'https://example.test/signup#first', steps: [{ url: 'https://example.test/signup#second' }] },
    ] })).toEqual([
      { rawUrl: 'https://example.test/signup#first', url: 'https://example.test/signup#first', path: '/signup', title: null },
      { rawUrl: 'https://example.test/signup#second', url: 'https://example.test/signup#second', path: '/signup', title: null },
    ])
  })
  it('does not invent a purchase or generic Outcome from a journey label', () => {
    const journeys = ['checkout', 'purchase', 'buy_flow', 'first-visit', 'contact-support', 'multi-step-funnel']
      .map(journeyType => ({ journeyType, startUrl: 'https://example.test/', steps: [] }))
    expect(discoverJourneyOutcomes(journeys)).toEqual([])
  })
  it('preserves the first recorded scope for repeated named journey inference', () => {
    expect(discoverJourneyOutcomes([
      { journeyType: 'sign_up', startUrl: 'https://example.test/first', steps: [{ url: 'https://example.test/confirm' }] },
      { journeyType: 'sign_up', startUrl: 'https://example.test/later', steps: [] },
    ])).toEqual([{ journeyType: 'sign_up', kind: 'SIGNUP', name: 'sign up', slug: 'sign-up',
      urls: ['https://example.test/first', 'https://example.test/confirm'] }])
  })
  it('rejects invalid recorded URLs rather than substituting another page', () => {
    expect(() => discoverOutcomePages('https://example.test/', { pages: [{ url: 'invalid recorded URL', title: null }], journeyReviews: [] })).toThrow()
  })
})
