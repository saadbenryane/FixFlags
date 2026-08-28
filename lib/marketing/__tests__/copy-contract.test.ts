import { describe, expect, it } from 'vitest'

import {
  CUSTOMER_TERMS,
  FLAG_STATUS_LABELS,
  HERO,
  LANDING_PAGE,
  RECHECK_DIFF_COPY,
  REPORT_COPY,
} from '@/lib/marketing/copy'
import {
  HERO as HOMEPAGE_HERO,
  LANDING_PAGE as HOMEPAGE_LANDING_PAGE,
} from '@/lib/marketing/copy/homepage'
import { REPORT_COPY as WORKSPACE_REPORT_COPY } from '@/lib/marketing/copy/report-workspace'

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') {
    output.push(value)
    return output
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output))
    return output
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, output))
  }
  return output
}

describe('customer copy contract', () => {
  it('keeps the compatibility barrel aligned with the split modules', () => {
    expect(HERO).toBe(HOMEPAGE_HERO)
    expect(LANDING_PAGE).toBe(HOMEPAGE_LANDING_PAGE)
    expect(REPORT_COPY).toBe(WORKSPACE_REPORT_COPY)
  })

  it('uses Update review on customer-facing copy without changing internal keys', () => {
    expect(CUSTOMER_TERMS.updateReview).toBe('Update review')
    expect(CUSTOMER_TERMS.updateReviews).toBe('Update reviews')
    expect(REPORT_COPY.recheck.label).toBe('Update review')

    const visibleCopy = collectStrings({ HERO, LANDING_PAGE, REPORT_COPY }).filter(
      (value) => value !== 'recheck',
    )
    expect(visibleCopy.join('\n')).not.toMatch(/\bre-?checks?\b/i)
  })

  it('keeps raw review absence separate from strict verification', () => {
    expect(FLAG_STATUS_LABELS.FIXED.label).toBe('No longer observed')
    expect(RECHECK_DIFF_COPY.cleared).toBe('No longer observed')
    expect(RECHECK_DIFF_COPY.inconclusive).toBe('Inconclusive')
    expect(REPORT_COPY.verificationReceipts.outcomes).toEqual({
      IMPROVED: 'Improved',
      UNCHANGED: 'Unchanged',
      REGRESSED: 'Regressed',
      INCONCLUSIVE: 'Inconclusive',
    })
    expect(REPORT_COPY.verificationReceipts.noLongerObserved).toBe(
      'No longer observed in this review.',
    )
  })

  it('describes review breadth in customer language', () => {
    const sentence = REPORT_COPY.explorer.coverageSentence({
      linkedPageCount: 4,
      openCheckCount: 24,
      partial: false,
    })
    expect(sentence).toBe('24 public links')
    expect(REPORT_COPY.explorer.onPath('/pricing')).toBe('On /pricing')
    expect(REPORT_COPY.explorer.onPages(8)).toBe('On 8 pages')
    expect(REPORT_COPY.explorer.productCoverage(0)).toBe('1 page')
    expect(REPORT_COPY.explorer.productCoverage(6)).toBe('7 pages')
    expect(REPORT_COPY.explorer.topFlagsTitle).toBe('Top Flags')
    expect(REPORT_COPY.explorer.coverageSentence({ openCheckCount: 1 })).toBe('1 public link')
    expect(
      REPORT_COPY.explorer.coverageSentence({ openCheckCount: 24, partial: true })
    ).toMatch(/Partial capture/)
    const visible = collectStrings(REPORT_COPY.explorer)
    expect(visible.join('\n')).not.toMatch(/\b(hops?|crawler|layers?)\b/i)
  })
})
