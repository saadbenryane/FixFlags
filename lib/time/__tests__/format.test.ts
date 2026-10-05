import { describe, expect, it } from 'vitest'
import { formatEvidenceTimestamp } from '@/lib/time/format'

describe('formatEvidenceTimestamp', () => {
  it('renders one explicit UTC value for server and browser evidence', () => {
    expect(formatEvidenceTimestamp('2026-09-23T22:57:11.000Z')).toBe('Sep 23, 2026, 10:57 PM UTC')
  })

  it('does not invent a timestamp for absent or invalid evidence', () => {
    expect(formatEvidenceTimestamp(null)).toBeNull()
    expect(formatEvidenceTimestamp('not-a-date')).toBeNull()
  })
})
