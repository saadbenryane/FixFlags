import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { parseMetadataFromHtml } from '../metadata'
import { runContentChecks } from '../checks/content'
import { runMetadataChecks } from '../checks/metadata-checks'
import { runTrustChecks } from '../checks/trust'
import { runAccessibilityChecks } from '../checks/accessibility'
import { runSlopChecks } from '../checks/slop'
import { runMeasurementChecks } from '../checks/measurement'
import { runSecurityBasicsChecks } from '../checks/security'
import { detectPagePurpose } from '../page-purpose'

const FIXTURE_DIR = 'lib/audit/__tests__/fixtures/sites'
const URL = 'https://example.com'

interface FlagAssertion {
  checkId: string
  severity: 'CRITICAL' | 'IMPORTANT' | 'POLISH'
}

function findFlag(flags: Array<{ checkId: string; severity: string }>, checkId: string, severity: string) {
  return flags.some((f) => f.checkId === checkId && f.severity === severity)
}

function flagSummary(flags: Array<{ checkId: string; severity: string }>): string {
  return flags.map((f) => `${f.severity}:${f.checkId}`).join(', ')
}

function testFixture(
  file: string,
  expectedCount: number,
  expectedFlags: FlagAssertion[],
  unexpectedCheckIds: string[] = []
) {
  it(`produces ${expectedCount} flags for ${file}`, () => {
    const html = readFileSync(`${FIXTURE_DIR}/${file}`, 'utf-8')
    const meta = parseMetadataFromHtml(html, URL)
    const purpose = detectPagePurpose(meta, URL)

    const flags = [
      ...runMetadataChecks(meta),
      ...runContentChecks(meta, purpose),
      ...runTrustChecks(URL, meta, []),
      ...runAccessibilityChecks(meta, null),
      ...runSlopChecks(meta),
      ...runMeasurementChecks(meta),
      ...runSecurityBasicsChecks(URL, meta),
    ]

    const ids = flags.map((f) => f.checkId)
    const summary = flagSummary(flags)

    // Assert total count (catches unexpected new flags or missing flags)
    assert.equal(flags.length, expectedCount, `Expected ${expectedCount} flags, got ${flags.length}. Summary: ${summary}`)

    // Assert each expected flag is present with correct severity
    for (const expected of expectedFlags) {
      assert.ok(
        findFlag(flags, expected.checkId, expected.severity),
        `Expected flag "${expected.checkId}" with severity "${expected.severity}" not found. Summary: ${summary}`
      )
    }

    // Assert unexpected flags are absent
    for (const unexpected of unexpectedCheckIds) {
      assert.ok(
        !ids.includes(unexpected),
        `Unexpected flag "${unexpected}" found. Summary: ${summary}`
      )
    }
  })
}

describe('regression: clean-page.html', () => {
  testFixture(
    'clean-page.html',
    1,
    [
      { checkId: 'measurement-ga-gtm-posthog-missing', severity: 'POLISH' },
    ],
    // consent flag must stay absent: no analytics detected means no consent gap.
    []
  )
})

describe('regression: broken-page.html', () => {
  testFixture(
    'broken-page.html',
    18,
    [
      { checkId: 'title-missing', severity: 'CRITICAL' },
      { checkId: 'description-missing', severity: 'IMPORTANT' },
      { checkId: 'og-image-missing', severity: 'IMPORTANT' },
      { checkId: 'og-title-missing', severity: 'POLISH' },
      { checkId: 'og-description-missing', severity: 'POLISH' },
      { checkId: 'lang-missing', severity: 'POLISH' },
      { checkId: 'favicon-missing', severity: 'POLISH' },
      { checkId: 'h1-generic', severity: 'IMPORTANT' },
      { checkId: 'no-cta-detected', severity: 'IMPORTANT' },
      { checkId: 'heading-hierarchy-missing', severity: 'POLISH' },
      { checkId: 'form-missing-validation', severity: 'IMPORTANT' },
      { checkId: 'no-privacy-policy', severity: 'POLISH' },
      { checkId: 'no-contact-info', severity: 'POLISH' },
      { checkId: 'images-missing-alt', severity: 'IMPORTANT' },
      { checkId: 'form-inputs-no-label', severity: 'IMPORTANT' },
      { checkId: 'buttons-no-text', severity: 'IMPORTANT' },
      { checkId: 'iframe-no-title', severity: 'POLISH' },
      { checkId: 'measurement-ga-gtm-posthog-missing', severity: 'POLISH' },
    ],
    // template-default-copy must stay absent: this fixture's generic body prose is
    // not a heading template default. consent flag absent: no analytics detected.
    ['scroll-ghost-sections', 'visual-radius-inconsistent', 'template-default-copy']
  )
})

describe('regression: saadbenryane-com.html', () => {
  testFixture(
    'saadbenryane-com.html',
    3,
    [
      // Portfolio page classified as 'article' — no-cta-detected suppressed.
      // JSON-LD email detection finds contact info — no-contact-info suppressed.
      { checkId: 'no-privacy-policy', severity: 'POLISH' },
      { checkId: 'skip-link-missing', severity: 'POLISH' },
      { checkId: 'measurement-ga-gtm-posthog-missing', severity: 'POLISH' },
    ],
    ['form-missing-validation', 'scroll-ghost-sections', 'visual-radius-inconsistent', 'no-cta-detected', 'no-contact-info']
  )
})

describe('regression: html5up-paradigm-shift.html', () => {
  testFixture(
    'html5up-paradigm-shift.html',
    7,
    [
      { checkId: 'description-missing', severity: 'IMPORTANT' },
      { checkId: 'lang-missing', severity: 'POLISH' },
      { checkId: 'canonical-missing', severity: 'POLISH' },
      { checkId: 'form-missing-validation', severity: 'IMPORTANT' },
      { checkId: 'no-privacy-policy', severity: 'POLISH' },
      { checkId: 'cookie-consent-absent', severity: 'POLISH' },
      { checkId: 'form-inputs-no-label', severity: 'IMPORTANT' },
    ],
    // measurement-consent-blocking-incomplete removed as a duplicate of
    // cookie-consent-absent.
    ['template-default-copy', 'placeholder-copy-detected', 'scroll-ghost-sections', 'visual-radius-inconsistent']
  )
})

describe('regression: nextjs-org.html', () => {
  testFixture(
    'nextjs-org.html',
    2,
    [
      { checkId: 'canonical-missing', severity: 'POLISH' },
      { checkId: 'measurement-ga-gtm-posthog-missing', severity: 'POLISH' },
    ],
    ['template-default-copy', 'placeholder-copy-detected', 'form-missing-validation', 'images-empty-alt']
  )
})

describe('regression: vercel-com.html', () => {
  testFixture(
    'vercel-com.html',
    2,
    [
      { checkId: 'description-too-short', severity: 'POLISH' },
      { checkId: 'measurement-ga-gtm-posthog-missing', severity: 'POLISH' },
    ],
    // links-no-text must stay absent: vercel.com's icon links are labeled via
    // aria-label / child svg title, which the accessible-name parser now honors.
    ['template-default-copy', 'placeholder-copy-detected', 'scroll-ghost-sections', 'links-no-text']
  )
})
