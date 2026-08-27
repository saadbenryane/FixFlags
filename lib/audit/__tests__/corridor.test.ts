import { describe, expect, it } from 'vitest'
import { runCorridorConsistencyChecks } from '@/lib/audit/checks/corridor-consistency'

describe('runCorridorConsistencyChecks', () => {
  it('flags identical og titles across corridor pages', () => {
    const flags = runCorridorConsistencyChecks([
      {
        url: 'https://example.com/',
        role: 'primary',
        ogTitle: 'Same Title',
        ogDescription: 'A',
        title: 'Same Title',
      },
      {
        url: 'https://example.com/pricing',
        role: 'pricing',
        ogTitle: 'Same Title',
        ogDescription: 'B',
        title: 'Same Title',
      },
    ])
    expect(flags.some((f) => f.checkId === 'corridor-og-title-drift')).toBe(true)
  })

  it('passes when titles differ', () => {
    const flags = runCorridorConsistencyChecks([
      {
        url: 'https://example.com/',
        role: 'primary',
        ogTitle: 'Home',
        ogDescription: 'Home desc that is long enough',
        title: 'Home',
      },
      {
        url: 'https://example.com/pricing',
        role: 'pricing',
        ogTitle: 'Pricing',
        ogDescription: 'Pricing desc that is long enough',
        title: 'Pricing',
      },
    ])
    expect(flags).toHaveLength(0)
  })
})
