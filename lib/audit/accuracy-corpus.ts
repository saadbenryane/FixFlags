/**
 * Canonical offline accuracy corpus for HTML fixture expectations.
 *
 * Consumed by `scripts/accuracy-eval.ts`, `report-quality-eval.test.ts`, and
 * agent skills. Keep fixture expectations here; not duplicated in scripts.
 */

export type AccuracyFixtureTier =
  | 'gold'
  | 'builder'
  | 'personal'
  | 'broken'
  | 'control'
  | 'structural'

export interface AccuracyHtmlFixture {
  file: string
  url: string
  tier: AccuracyFixtureTier
  /** Max CRITICAL/IMPORTANT flags allowed before the gate fails. Use 99 when flags are expected. */
  maxImportantFalseBlockers: number
  expectedTop3: string[]
  knownFalsePositives: string[]
  expectedPresent: string[]
  /** When true, known missing URLs return 404 for broken-link checks (demo v1 only). */
  brokenLinks?: boolean
}

export const ACCURACY_FIXTURE_DIR = 'lib/audit/__tests__/fixtures/sites'

export const ACCURACY_HTML_FIXTURES: AccuracyHtmlFixture[] = [
  {
    file: 'clean-page.html',
    url: 'https://fixflags.com/demo/v1',
    tier: 'control',
    maxImportantFalseBlockers: 99,
    expectedTop3: ['og-image-broken', 'broken-internal-links', 'messaging-no-audience'],
    knownFalsePositives: [],
    expectedPresent: ['measurement-ga-gtm-posthog-missing'],
    brokenLinks: true,
  },
  {
    file: 'nextjs-org.html',
    url: 'https://nextjs.org',
    tier: 'gold',
    maxImportantFalseBlockers: 0,
    expectedTop3: ['messaging-no-audience', 'measurement-ga-gtm-posthog-missing', 'canonical-missing'],
    knownFalsePositives: [
      'template-default-copy',
      'placeholder-copy-detected',
      'form-missing-validation',
      'images-empty-alt',
    ],
    expectedPresent: ['canonical-missing', 'measurement-ga-gtm-posthog-missing'],
  },
  {
    file: 'vercel-com.html',
    url: 'https://vercel.com',
    tier: 'gold',
    maxImportantFalseBlockers: 0,
    expectedTop3: ['friction-no-risk-reversal', 'trust-no-authority-signals', 'description-too-short'],
    knownFalsePositives: [
      'template-default-copy',
      'placeholder-copy-detected',
      'scroll-ghost-sections',
      'links-no-text',
    ],
    expectedPresent: ['description-too-short', 'measurement-ga-gtm-posthog-missing'],
  },
  {
    file: 'lovable-dev.html',
    url: 'https://lovable.dev',
    tier: 'builder',
    maxImportantFalseBlockers: 0,
    expectedTop3: [
      'friction-no-social-proof',
      'measurement-ga-gtm-posthog-missing',
      'no-structured-data',
    ],
    knownFalsePositives: ['messaging-weak-value-prop', 'links-no-text', 'buttons-no-text'],
    expectedPresent: ['measurement-ga-gtm-posthog-missing', 'friction-no-social-proof'],
  },
  {
    file: 'bolt-new.html',
    url: 'https://bolt.new',
    tier: 'builder',
    maxImportantFalseBlockers: 2,
    expectedTop3: ['trust-unsupported-claims', 'links-no-text', 'trust-no-authority-signals'],
    knownFalsePositives: ['messaging-weak-value-prop'],
    expectedPresent: ['trust-unsupported-claims', 'links-no-text'],
  },
  {
    file: 'cineverse-replit-app.html',
    url: 'https://cineverse.replit.app',
    tier: 'builder',
    maxImportantFalseBlockers: 2,
    expectedTop3: ['h1-missing', 'no-privacy-policy', 'measurement-ga-gtm-posthog-missing'],
    knownFalsePositives: [],
    expectedPresent: ['h1-missing', 'measurement-ga-gtm-posthog-missing', 'no-privacy-policy'],
  },
  {
    file: 'saadbenryane-com.html',
    url: 'https://saadbenryane.com',
    tier: 'personal',
    maxImportantFalseBlockers: 2,
    expectedTop3: ['no-cta-detected', 'messaging-no-audience', 'no-privacy-policy'],
    knownFalsePositives: ['form-missing-validation', 'scroll-ghost-sections', 'visual-radius-inconsistent'],
    expectedPresent: ['no-cta-detected', 'skip-link-missing', 'no-privacy-policy'],
  },
  {
    file: 'broken-page.html',
    url: 'https://example.com/broken',
    tier: 'broken',
    maxImportantFalseBlockers: 99,
    expectedTop3: ['title-missing', 'form-missing-validation', 'h1-generic'],
    knownFalsePositives: ['scroll-ghost-sections', 'visual-radius-inconsistent', 'template-default-copy'],
    expectedPresent: [
      'title-missing',
      'description-missing',
      'no-cta-detected',
      'form-missing-validation',
      'images-missing-alt',
    ],
  },
  {
    file: 'html5up-paradigm-shift.html',
    url: 'https://html5up.net',
    tier: 'structural',
    maxImportantFalseBlockers: 99,
    expectedTop3: ['form-missing-validation', 'form-inputs-no-label', 'description-missing'],
    knownFalsePositives: [
      'template-default-copy',
      'placeholder-copy-detected',
      'scroll-ghost-sections',
      'visual-radius-inconsistent',
    ],
    expectedPresent: ['description-missing', 'form-missing-validation'],
  },
  {
    file: 'linear-app.html',
    url: 'https://linear.app',
    tier: 'structural',
    maxImportantFalseBlockers: 99,
    expectedTop3: [],
    knownFalsePositives: [],
    expectedPresent: ['no-structured-data', 'cookie-consent-absent'],
  },
  {
    file: 'v0-dev.html',
    url: 'https://v0.dev',
    tier: 'structural',
    maxImportantFalseBlockers: 99,
    expectedTop3: [],
    knownFalsePositives: [],
    expectedPresent: ['no-structured-data', 'measurement-ga-gtm-posthog-missing'],
  },
  {
    file: 'replit-com.html',
    url: 'https://replit.com',
    tier: 'structural',
    maxImportantFalseBlockers: 99,
    expectedTop3: [],
    knownFalsePositives: [],
    expectedPresent: ['canonical-missing', 'h1-multiple'],
  },
]

/** Fixtures that participate in the launch accuracy gate (excludes control-only rows). */
export function accuracyGateFixtures(): AccuracyHtmlFixture[] {
  return ACCURACY_HTML_FIXTURES.filter((fixture) => fixture.tier !== 'control')
}

/** Gold-standard sites must never surface false CRITICAL/IMPORTANT blockers. */
export function goldAccuracyFixtures(): AccuracyHtmlFixture[] {
  return ACCURACY_HTML_FIXTURES.filter((fixture) => fixture.tier === 'gold')
}
