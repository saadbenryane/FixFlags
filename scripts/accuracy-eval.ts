/**
 * Offline accuracy evaluation gate for FixFlags scan quality.
 *
 * Runs frozen HTML/JSON fixtures, demo v1 repair proof, and report-quality
 * expectations. Exits non-zero on regression.
 *
 *   npm run accuracy:eval
 */
import { readFileSync, existsSync } from 'node:fs'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { runAllChecks } from '@/lib/audit/checks'
import { rankFlagsByPriority, type RankableFlag } from '@/lib/audit/priority-flags'
import { compareDemoFixtures } from '@/lib/demo/audit-demo-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { runNetworkEngagementChecks } from '@/lib/audit/checks/network-engagement'
import { runOverlayBlockerChecks } from '@/lib/audit/checks/overlay'
import { flowCheckIdForStatus } from '@/lib/audit/flow/flow-evidence'

const FIXTURE_DIR = 'lib/audit/__tests__/fixtures/sites'
const NO_CONSOLE: Array<{ type: string; text: string }> = []
const NO_HEADERS: Record<string, string> = {}

interface HtmlFixtureSpec {
  file: string
  url: string
  tier: 'gold' | 'builder' | 'personal' | 'broken' | 'control'
  maxImportantFalseBlockers: number
  expectedTop3: string[]
  knownFalsePositives: string[]
  expectedPresent: string[]
}

const HTML_FIXTURES: HtmlFixtureSpec[] = [
  {
    file: 'clean-page.html',
    url: 'https://fixflags.com/demo/v1',
    tier: 'control',
    maxImportantFalseBlockers: 99,
    expectedTop3: [],
    knownFalsePositives: [],
    expectedPresent: [],
  },
  {
    file: 'nextjs-org.html',
    url: 'https://nextjs.org',
    tier: 'gold',
    maxImportantFalseBlockers: 0,
    expectedTop3: ['messaging-no-audience', 'security-hsts-missing', 'security-csp-missing'],
    knownFalsePositives: ['template-default-copy', 'placeholder-copy-detected', 'form-missing-validation', 'images-empty-alt'],
    expectedPresent: ['canonical-missing', 'measurement-ga-gtm-posthog-missing'],
  },
  {
    file: 'vercel-com.html',
    url: 'https://vercel.com',
    tier: 'gold',
    maxImportantFalseBlockers: 0,
    expectedTop3: ['friction-no-risk-reversal', 'security-hsts-missing', 'security-csp-missing'],
    knownFalsePositives: ['template-default-copy', 'placeholder-copy-detected', 'scroll-ghost-sections', 'links-no-text'],
    expectedPresent: ['description-too-short', 'measurement-ga-gtm-posthog-missing'],
  },
  {
    file: 'lovable-dev.html',
    url: 'https://lovable.dev',
    tier: 'builder',
    maxImportantFalseBlockers: 0,
    expectedTop3: ['security-hsts-missing', 'security-csp-missing', 'security-content-type-options-missing'],
    knownFalsePositives: ['messaging-weak-value-prop', 'links-no-text', 'buttons-no-text'],
    expectedPresent: ['measurement-ga-gtm-posthog-missing', 'friction-no-social-proof'],
  },
  {
    file: 'bolt-new.html',
    url: 'https://bolt.new',
    tier: 'builder',
    maxImportantFalseBlockers: 2,
    expectedTop3: ['trust-unsupported-claims', 'links-no-text', 'security-hsts-missing'],
    knownFalsePositives: ['messaging-weak-value-prop'],
    expectedPresent: ['trust-unsupported-claims', 'links-no-text'],
  },
  {
    file: 'saadbenryane-com.html',
    url: 'https://saadbenryane.com',
    tier: 'personal',
    maxImportantFalseBlockers: 2,
    expectedTop3: ['no-cta-detected', 'trust-no-direct-contact', 'messaging-no-audience'],
    knownFalsePositives: ['form-missing-validation', 'scroll-ghost-sections', 'visual-radius-inconsistent'],
    expectedPresent: ['no-cta-detected', 'trust-no-direct-contact', 'skip-link-missing'],
  },
  {
    file: 'broken-page.html',
    url: 'https://example.com/broken',
    tier: 'broken',
    maxImportantFalseBlockers: 99,
    expectedTop3: ['title-missing', 'form-missing-validation', 'h1-generic'],
    knownFalsePositives: ['scroll-ghost-sections', 'visual-radius-inconsistent', 'template-default-copy'],
    expectedPresent: ['title-missing', 'description-missing', 'no-cta-detected', 'form-missing-validation'],
  },
]

function runFixtureChecks(file: string, url: string) {
  const html = readFileSync(`${FIXTURE_DIR}/${file}`, 'utf-8')
  const meta = parseMetadataFromHtml(html, url)
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('', { status: 200 })) as typeof fetch

  return runAllChecks(
    url,
    meta,
    null,
    null,
    NO_CONSOLE,
    undefined,
    undefined,
    NO_HEADERS
  ).finally(() => {
    globalThis.fetch = originalFetch
  })
}

function countImportantFalseBlockers(flags: RankableFlag[], tier: HtmlFixtureSpec['tier']): number {
  if (tier === 'broken' || tier === 'control') return 0
  return flags.filter((f) => f.severity === 'CRITICAL' || f.severity === 'IMPORTANT').length
}

async function evaluateHtmlFixtures() {
  const failures: string[] = []
  let goldImportantTotal = 0

  for (const fixture of HTML_FIXTURES) {
    if (!existsSync(`${FIXTURE_DIR}/${fixture.file}`)) {
      failures.push(`${fixture.file}: missing fixture file`)
      continue
    }

    if (fixture.tier === 'control') continue

    const { flags } = await runFixtureChecks(fixture.file, fixture.url)
    const flagIds = new Set(flags.map((f) => f.checkId))
    const sorted = [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId)) as RankableFlag[]
    const top3 = rankFlagsByPriority(sorted, [], 3).map((r) => r.flag.checkId ?? '')
    const importantCount = countImportantFalseBlockers(flags, fixture.tier)

    if (fixture.tier === 'gold') goldImportantTotal += importantCount
    if (importantCount > fixture.maxImportantFalseBlockers) {
      failures.push(
        `${fixture.file}: ${importantCount} CRITICAL/IMPORTANT flags exceeds max ${fixture.maxImportantFalseBlockers}`
      )
    }

    for (const expected of fixture.expectedTop3) {
      if (!top3.includes(expected)) {
        failures.push(`${fixture.file}: expected ${expected} in top-3, got ${top3.join(', ')}`)
      }
    }

    for (const fp of fixture.knownFalsePositives) {
      if (flagIds.has(fp)) failures.push(`${fixture.file}: known false positive ${fp} still present`)
    }

    for (const expected of fixture.expectedPresent) {
      if (!flagIds.has(expected)) failures.push(`${fixture.file}: expected present flag ${expected} missing`)
    }
  }

  if (goldImportantTotal > 0) {
    failures.push(`gold fixtures: expected 0 CRITICAL/IMPORTANT false blockers, got ${goldImportantTotal}`)
  }

  return failures
}

async function evaluateDemoRepair() {
  const comparison = await compareDemoFixtures({ mode: 'offline' })
  const failures: string[] = []
  if (comparison.baseline.flags.length < 8) {
    failures.push(`demo baseline expected >=8 flags, got ${comparison.baseline.flags.length}`)
  }
  if (comparison.fixed.flags.length !== 0) {
    failures.push(`demo v1 expected 0 in-scope flags, got ${comparison.fixed.flags.map((f) => f.checkId).join(', ')}`)
  }
  return failures
}

function evaluateNonHtmlFixture() {
  const failures: string[] = []
  const fixture = JSON.parse(
    readFileSync('lib/audit/__tests__/fixtures/non-html-regression.json', 'utf8')
  ) as {
    desktopPageSpeed: Parameters<typeof runPerformanceChecks>[0]
    mobilePageSpeed: Parameters<typeof runPerformanceChecks>[1]
    networkFailures: Parameters<typeof runNetworkEngagementChecks>[0]
    overlay: Parameters<typeof runOverlayBlockerChecks>[1]
    expectedCheckIds: string[]
  }

  const checkIds = [
    ...runPerformanceChecks(fixture.desktopPageSpeed, fixture.mobilePageSpeed),
    ...runNetworkEngagementChecks(fixture.networkFailures),
    ...runOverlayBlockerChecks('cta', fixture.overlay, 'Start free'),
  ].map((flag) => flag.checkId)
  const flowCheckId = flowCheckIdForStatus('dead_end')
  if (flowCheckId) checkIds.push(flowCheckId)

  const actual = checkIds.sort()
  const expected = [...fixture.expectedCheckIds].sort()
  if (actual.join(',') !== expected.join(',')) {
    failures.push(`non-html regression mismatch: expected ${expected.join(', ')}, got ${actual.join(', ')}`)
  }
  return failures
}

async function main() {
  const failures = [
    ...await evaluateHtmlFixtures(),
    ...await evaluateDemoRepair(),
    ...evaluateNonHtmlFixture(),
  ]

  console.log('FixFlags accuracy eval\n')
  console.log(`HTML fixtures: ${HTML_FIXTURES.length}`)
  console.log(`Failures: ${failures.length}`)

  if (failures.length > 0) {
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log('All accuracy checks passed.')
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
