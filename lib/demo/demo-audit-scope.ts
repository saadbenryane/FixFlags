import type { DeterministicFlag } from '@/lib/audit/checks'

/**
 * Checks excluded from the demo fixture iterate-to-zero loop.
 * These are site/env level, not what a developer fixes on the demo page fork.
 */
export const DEMO_FIXTURE_OUT_OF_SCOPE_CHECK_IDS = new Set([
  'no-https', // localhost dev server
  'sitemap-missing', // domain root
  'robots-txt-missing', // domain root
  'perf-score-critical',
  'perf-score-poor',
  'lcp-critical',
  'lcp-poor',
  'cls-critical',
  'cls-poor',
  'render-blocking',
  'unused-js-large',
  'unused-css-large',
  'unoptimized-images',
  'inp-critical',
  'inp-poor',
  'mobile-perf-critical',
  'mobile-perf-poor',
  'tap-targets-small',
  'mobile-lcp-critical',
  'cta-below-fold-mobile', // needs browser capture metrics
  'og-image-broken', // needs a live HTTP fetch of the og:image; offline fixture audit can't validate it
])

export const DEMO_FIXTURE_ORIGIN = 'https://fixflags.com'
export const DEMO_LOCAL_DEV_BASE = 'http://localhost:3000'

export function filterDemoFixtureFlags(flags: DeterministicFlag[]): DeterministicFlag[] {
  return flags.filter((f) => !DEMO_FIXTURE_OUT_OF_SCOPE_CHECK_IDS.has(f.checkId))
}

export function sortDemoFlags(flags: DeterministicFlag[]): DeterministicFlag[] {
  return [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId))
}
