export interface AccuracyBrowserTarget {
  url: string
  expectedPrimaryCtaText?: string | null
  expectedAbsentCheckIds: string[]
  expectedInputsBelow16Count?: number
}

/**
 * Live rendered regressions that HTML fixtures cannot represent. This corpus
 * is intentionally small and is run on demand, not in hermetic CI.
 */
export const ACCURACY_BROWSER_TARGETS: AccuracyBrowserTarget[] = [
  {
    url: 'https://fixflags.com/',
    expectedPrimaryCtaText: 'Review my site',
    expectedAbsentCheckIds: ['cta-below-fold-mobile'],
    expectedInputsBelow16Count: 2,
  },
  {
    url: 'https://saadbenryane.com/',
    expectedPrimaryCtaText: 'Book a call',
    expectedAbsentCheckIds: ['cta-below-fold-mobile'],
    expectedInputsBelow16Count: 0,
  },
  {
    url: 'https://saadbenryane.com/contact',
    expectedPrimaryCtaText: 'Book a call',
    expectedAbsentCheckIds: ['cta-below-fold-mobile'],
    expectedInputsBelow16Count: 0,
  },
  {
    url: 'https://saadbenryane.com/work/1health-platform',
    expectedPrimaryCtaText: null,
    expectedAbsentCheckIds: ['cta-below-fold-mobile', 'visual-radius-inconsistent'],
    expectedInputsBelow16Count: 0,
  },
  {
    url: 'https://saadbenryane.com/about',
    expectedPrimaryCtaText: null,
    expectedAbsentCheckIds: ['cta-below-fold-mobile'],
    expectedInputsBelow16Count: 0,
  },
  {
    url: 'https://developer.mozilla.org/en-US/docs/Web',
    expectedAbsentCheckIds: [],
  },
  {
    url: 'https://www.mozilla.org/en-US/firefox/new/',
    expectedAbsentCheckIds: [],
  },
  {
    url: 'https://vercel.com/new',
    expectedAbsentCheckIds: [],
  },
  {
    url: 'https://www.npmjs.com/',
    expectedAbsentCheckIds: [],
  },
  {
    url: 'https://mui.com/material-ui/react-button/',
    expectedAbsentCheckIds: [],
  },
  {
    url: 'https://www.shopify.com/ca',
    expectedAbsentCheckIds: [],
  },
  {
    url: 'https://www.paypal.com/us/webapps/mpp/account-selection',
    expectedAbsentCheckIds: [],
  },
  {
    url: 'https://github.com/login',
    expectedAbsentCheckIds: [],
  },
  {
    url: 'https://stripe.com/docs/checkout',
    expectedAbsentCheckIds: [],
  },
]
