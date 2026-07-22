import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { parseMetadataFromHtml } from '../metadata'
import { runAllChecks } from '../checks'
import { rankFlagsByPriority } from '../priority-flags'
import type { PageSpeedResult } from '../pagespeed'
import type { PageMetadata } from '../metadata'

const FIXTURE_DIR = 'lib/audit/__tests__/fixtures/sites'

/**
 * Regression eval set: expected top-3 ranking, known false positives that must
 * NOT appear, and expected present flags for each audited page. Every assertion
 * must be verifiable against the source HTML, not against URL-specific logic.
 *
 * Success criteria (from AGENTS.md):
 *  1. Top-3 findings are consistently credible, distinct, evidence-backed, actionable
 *  2. No prominent false positives or duplicates in top-3
 *  3. Fixed issues disappear after re-check (tested via demo v1 below)
 *  4. System expresses uncertainty instead of unsupported claims
 */

const EMPTY_PS: PageSpeedResult = { score: null, metrics: {} }
const NO_CONSOLE: Array<{ type: string; text: string }> = []
const NO_HEADERS: Record<string, string> = {}

function runFixtureChecks(file: string, url: string) {
  const html = readFileSync(`${FIXTURE_DIR}/${file}`, 'utf-8')
  const meta = parseMetadataFromHtml(html, url)
  return runAllChecks(
    url,
    meta,
    null,
    null,
    NO_CONSOLE,
    undefined,
    undefined,
    NO_HEADERS
  )
}

function top3CheckIds(flags: Array<{ checkId: string }>): string[] {
  const sorted = [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId))
  return rankFlagsByPriority(sorted as any, [], 3).map((r) => r.flag.checkId ?? '')
}

interface FixtureEval {
  file: string
  url: string
  /** checkIds expected to appear in top-3, in priority order */
  expectedTop3: string[]
  /** checkIds that must NOT appear anywhere in the flag output */
  knownFalsePositives: string[]
  /** checkIds expected to be present (not necessarily in top-3) */
  expectedPresent: string[]
}

const FIXTURES: FixtureEval[] = [
  {
    file: 'clean-page.html',
    url: 'https://fixflags.com/demo/v1',
    // og-image-broken(SHARING) and broken-internal-links(SEO) rank highest
    // among IMPORTANT flags. messaging-no-audience has CONVERSION impact
    // so ranks first among POLISH.
    expectedTop3: ['og-image-broken', 'broken-internal-links', 'messaging-no-audience'],
    knownFalsePositives: [],
    expectedPresent: ['measurement-ga-gtm-posthog-missing'],
  },
  {
    file: 'broken-page.html',
    url: 'https://example.com/broken',
    // CRITICAL > IMPORTANT. form-missing-validation(CONVERSION) ranks
    // above description-missing(SEO) by impact. h1-generic(CONVERSION)
    // also outranks description-missing.
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
    file: 'nextjs-org.html',
    url: 'https://nextjs.org',
    // All POLISH. messaging-no-audience has CONVERSION impact (ranks first).
    // security-hsts-missing(TRUST) before security-csp-missing(TRUST) by checkId.
    expectedTop3: ['messaging-no-audience', 'security-hsts-missing', 'security-csp-missing'],
    knownFalsePositives: ['template-default-copy', 'placeholder-copy-detected', 'form-missing-validation', 'images-empty-alt'],
    expectedPresent: ['canonical-missing', 'measurement-ga-gtm-posthog-missing'],
  },
  {
    file: 'vercel-com.html',
    url: 'https://vercel.com',
    // All POLISH. friction-no-risk-reversal has CONVERSION impact (ranks first).
    // security-hsts/csp have TRUST impact.
    expectedTop3: ['friction-no-risk-reversal', 'security-hsts-missing', 'security-csp-missing'],
    knownFalsePositives: ['template-default-copy', 'placeholder-copy-detected', 'scroll-ghost-sections', 'links-no-text'],
    expectedPresent: ['description-too-short', 'measurement-ga-gtm-posthog-missing'],
  },
  {
    file: 'html5up-paradigm-shift.html',
    url: 'https://html5up.net',
    // All IMPORTANT. form-missing-validation(CONVERSION) ranks first.
    // form-inputs-no-label(ACCESSIBILITY) second. description-missing(SEO) third.
    expectedTop3: ['form-missing-validation', 'form-inputs-no-label', 'description-missing'],
    knownFalsePositives: ['template-default-copy', 'placeholder-copy-detected', 'scroll-ghost-sections', 'visual-radius-inconsistent'],
    expectedPresent: ['description-missing', 'form-missing-validation'],
  },
]

describe('report quality eval: top-3 ranking', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.file} top-3 are correct and distinct`, async () => {
      const { flags } = await runFixtureChecks(fixture.file, fixture.url)
      const sorted = [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId))
      const ranked = rankFlagsByPriority(sorted as any, [], 3)
      const top3Ids = ranked.map((r) => r.flag.checkId ?? '')

      // Top-3 must be distinct (no duplicates)
      assert.equal(
        new Set(top3Ids).size,
        top3Ids.length,
        `top-3 has duplicates: ${top3Ids.join(', ')}`
      )

      // Top-3 must match expected (within expected tolerance)
      for (const expected of fixture.expectedTop3) {
        assert.ok(
          top3Ids.includes(expected),
          `Expected ${expected} in top-3 but got: ${top3Ids.join(', ')}. Full flags: ${flags.map((f) => `${f.severity}:${f.checkId}`).join(', ')}`
        )
      }
    })

    it(`${fixture.file} has no known false positives`, async () => {
      const { flags } = await runFixtureChecks(fixture.file, fixture.url)
      const flagIds = new Set(flags.map((f) => f.checkId))

      for (const fp of fixture.knownFalsePositives) {
        assert.ok(
          !flagIds.has(fp),
          `Known false positive ${fp} still present. All flags: ${[...flagIds].join(', ')}`
        )
      }
    })

    it(`${fixture.file} has expected flags present`, async () => {
      const { flags } = await runFixtureChecks(fixture.file, fixture.url)
      const flagIds = new Set(flags.map((f) => f.checkId))

      for (const expected of fixture.expectedPresent) {
        assert.ok(
          flagIds.has(expected),
          `Expected flag ${expected} not found. All flags: ${[...flagIds].join(', ')}`
        )
      }
    })
  }
})
