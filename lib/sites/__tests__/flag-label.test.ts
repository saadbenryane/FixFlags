import { describe, expect, it } from 'vitest'
import { customerExpectedBehavior, customerFlagContext } from '@/lib/sites/flag-label'

describe('customerFlagContext', () => {
  it('names the card and the severity a customer already sees elsewhere', () => {
    expect(customerFlagContext('search', 'IMPORTANT')).toBe('Search · Important Flag')
    expect(customerFlagContext('conversion', 'CRITICAL')).toBe('Conversion · Critical Flag')
    expect(customerFlagContext('search', 'IMPORTANT')).not.toMatch(/search · important/)
  })

  it('uses the current missing-description result instead of a stored page-source procedure', () => {
    const stored = 'View page source, confirm meta name="description" with content.'
    const shown = customerExpectedBehavior('description-missing', stored)
    expect(shown).toBe('The page includes a meta description a search result can show.')
    expect(shown).not.toMatch(/page source/)
    expect(customerExpectedBehavior(null, 'A confirmation appears after submit.')).toBe(
      'A confirmation appears after submit.'
    )
  })
})
