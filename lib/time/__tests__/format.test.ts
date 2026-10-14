import { describe, expect, it, vi } from 'vitest'
import { formatEvidenceTimestamp } from '@/lib/time/format'

describe('formatEvidenceTimestamp', () => {
  it('renders one explicit UTC value for server and browser evidence', () => {
    expect(formatEvidenceTimestamp('2026-09-23T22:57:11.000Z')).toBe('Sep 23, 2026, 10:57 PM UTC')
  })

  it('ignores engine-specific date punctuation during hydration', () => {
    const original = Intl.DateTimeFormat.prototype.formatToParts
    const formatter = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(function (date) {
      return original.call(this, date).map(part => part.type === 'literal' ? { ...part, value: ' at ' } : part)
    })
    try {
      expect(formatEvidenceTimestamp('2026-09-14T09:00:00.000Z')).toBe('Sep 14, 2026, 9:00 AM UTC')
    } finally {
      formatter.mockRestore()
    }
  })

  it.each([
    ['2026-09-14T00:00:00.000Z', 'Sep 14, 2026, 12:00 AM UTC'],
    ['2026-09-14T12:00:00.000Z', 'Sep 14, 2026, 12:00 PM UTC'],
  ])('renders midnight and noon with a stable twelve-hour clock (%s)', (instant, expected) => {
    expect(formatEvidenceTimestamp(instant)).toBe(expected)
  })

  it('does not invent a timestamp for absent or invalid evidence', () => {
    expect(formatEvidenceTimestamp(null)).toBeNull()
    expect(formatEvidenceTimestamp('not-a-date')).toBeNull()
  })
})
