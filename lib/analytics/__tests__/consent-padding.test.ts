import { describe, expect, it } from 'vitest'
import { CONSENT_CLEARANCE_PX, consentPagePadding } from '@/lib/analytics/consent'

describe('consentPagePadding', () => {
  it('reserves the first screen until the visitor chooses', () => {
    expect(consentPagePadding(undefined)).toBe(`${CONSENT_CLEARANCE_PX}px`)
    expect(consentPagePadding(null)).toBe(`${CONSENT_CLEARANCE_PX}px`)
    expect(consentPagePadding('')).toBe(`${CONSENT_CLEARANCE_PX}px`)
  })

  it('does not reserve space after a choice is stored', () => {
    expect(consentPagePadding('denied')).toBeUndefined()
    expect(consentPagePadding('granted')).toBeUndefined()
  })
})
