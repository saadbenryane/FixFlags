import { describe, expect, it } from 'vitest'
import { summarySubject, type SummarySite } from '../website-summary'

const site = (overrides: Partial<SummarySite> = {}): SummarySite => ({
  id: 's', url: 'https://shop.com', problems: 0, checkedAt: new Date('2026-11-10T09:00:00Z'),
  incomplete: false, failed: false, unchanged: false, offline: false, ...overrides,
})

describe('summary subject', () => {
  it('leads with the number of problems across websites', () => {
    expect(summarySubject('WEEKLY', [site({ problems: 1 }), site({ problems: 2 })])).toBe('Weekly summary: 3 problems to review')
    expect(summarySubject('DAILY', [site({ problems: 1 })])).toBe('Daily summary: 1 problem to review')
  })

  it('says no problems were found only when every website has a fresh, complete check', () => {
    expect(summarySubject('WEEKLY', [site(), site()])).toBe('Weekly summary: no problems found')
    for (const gap of [{ checkedAt: null }, { incomplete: true }, { failed: true }, { offline: true }, { stale: true }, { urgentOnly: true }])
      expect(summarySubject('WEEKLY', [site(), site(gap)])).toBe('Your weekly website update')
    expect(summarySubject('WEEKLY', [])).toBe('Your weekly website update')
  })
})
