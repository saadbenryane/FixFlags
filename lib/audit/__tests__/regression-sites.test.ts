import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { parseMetadataFromHtml } from '../metadata'
import { runContentChecks } from '../checks/content'
import { runMetadataChecks } from '../checks/metadata-checks'
import { runTrustChecks } from '../checks/trust'
import { runAccessibilityChecks } from '../checks/accessibility'
import { runSlopChecks } from '../checks/slop'

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

    const flags = [
      ...runMetadataChecks(meta),
      ...runContentChecks(meta),
      ...runTrustChecks(URL, meta, []),
      ...runAccessibilityChecks(meta, null),
      ...runSlopChecks(meta),
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
  testFixture('clean-page.html', 0, [], [])
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
      { checkId: 'template-default-copy', severity: 'IMPORTANT' },
    ],
    ['scroll-ghost-sections', 'visual-radius-inconsistent']
  )
})

describe('regression: saadbenryane-com.html', () => {
  testFixture(
    'saadbenryane-com.html',
    3,
    [
      { checkId: 'no-cta-detected', severity: 'IMPORTANT' },
      { checkId: 'no-privacy-policy', severity: 'POLISH' },
      { checkId: 'skip-link-missing', severity: 'POLISH' },
    ],
    ['form-missing-validation', 'scroll-ghost-sections', 'visual-radius-inconsistent']
  )
})
