export interface AccuracyBrowserTarget {
  url: string
  expectedPrimaryCtaText: string | null
  expectedAbsentCheckIds: string[]
}

/**
 * Live rendered regressions that HTML fixtures cannot represent. This corpus
 * is intentionally small and is run on demand, not in hermetic CI.
 */
export const ACCURACY_BROWSER_TARGETS: AccuracyBrowserTarget[] = [
  {
    url: 'https://saadbenryane.com/',
    expectedPrimaryCtaText: 'Book a call',
    expectedAbsentCheckIds: ['cta-below-fold-mobile'],
  },
  {
    url: 'https://saadbenryane.com/contact',
    expectedPrimaryCtaText: 'Book a call',
    expectedAbsentCheckIds: ['cta-below-fold-mobile'],
  },
  {
    url: 'https://saadbenryane.com/work/1health-platform',
    expectedPrimaryCtaText: null,
    expectedAbsentCheckIds: ['cta-below-fold-mobile'],
  },
  {
    url: 'https://saadbenryane.com/about',
    expectedPrimaryCtaText: null,
    expectedAbsentCheckIds: ['cta-below-fold-mobile'],
  },
]
