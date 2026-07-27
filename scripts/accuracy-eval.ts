/**
 * Offline accuracy evaluation gate for FixFlags scan quality.
 *
 *   npm run accuracy:eval
 */
import { existsSync, readFileSync } from 'node:fs'
import {
  ACCURACY_FIXTURE_DIR,
  accuracyGateFixtures,
  goldAccuracyFixtures,
  type AccuracyFixtureTier,
} from '@/lib/audit/accuracy-corpus'
import { runAccuracyFixtureChecks } from '@/lib/audit/fixture-html'
import { rankFlagsByPriority, type RankableFlag } from '@/lib/audit/priority-flags'
import { compareDemoFixtures } from '@/lib/demo/audit-demo-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { runNetworkEngagementChecks } from '@/lib/audit/checks/network-engagement'
import { runOverlayBlockerChecks } from '@/lib/audit/checks/overlay'
import { runSlowReplayChecks } from '@/lib/audit/checks/slow-replay'
import { runLayoutChecks } from '@/lib/audit/checks/layout'
import type { CaptureMetrics } from '@/lib/audit/capture-metrics'
import { flowCheckIdForStatus } from '@/lib/audit/flow/flow-evidence'

function countImportantFalseBlockers(flags: RankableFlag[], tier: AccuracyFixtureTier): number {
  if (tier === 'broken' || tier === 'control' || tier === 'structural') return 0
  return flags.filter((f) => f.severity === 'CRITICAL' || f.severity === 'IMPORTANT').length
}

async function evaluateHtmlFixtures() {
  const failures: string[] = []
  let goldImportantTotal = 0
  let totalFlags = 0
  let totalImportant = 0
  let totalPolish = 0
  let goldTotalFlags = 0
  let goldImportantFlags = 0

  for (const fixture of accuracyGateFixtures()) {
    if (!existsSync(`${ACCURACY_FIXTURE_DIR}/${fixture.file}`)) {
      failures.push(`${fixture.file}: missing fixture file`)
      continue
    }

    const { flags } = await runAccuracyFixtureChecks(fixture)
    const flagIds = new Set(flags.map((f) => f.checkId))
    const sorted = [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId)) as RankableFlag[]
    const top3 = rankFlagsByPriority(sorted, [], 3).map((r) => r.flag.checkId ?? '')
    const importantCount = countImportantFalseBlockers(flags as RankableFlag[], fixture.tier)

    totalFlags += flags.length
    totalImportant += flags.filter((f) => f.severity === 'CRITICAL' || f.severity === 'IMPORTANT').length
    totalPolish += flags.filter((f) => f.severity === 'POLISH').length

    if (fixture.tier === 'gold') {
      goldImportantTotal += importantCount
      goldTotalFlags += flags.length
      goldImportantFlags += flags.filter((f) => f.severity === 'CRITICAL' || f.severity === 'IMPORTANT').length
    }
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

  return { failures, totalFlags, totalImportant, totalPolish, goldTotalFlags, goldImportantFlags }
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
    slowReplay?: {
      timeToFirstTextMs: number
      timeToCtaMs: number
      screenshotUrls: string[]
    }
    mobileLayoutCases?: Array<{
      name: string
      mobilePrimaryCtaTopPx: number | null
      mobilePrimaryCtaText: string | null
      mobileViewportHeight: number
      expectedCheckIds: string[]
    }>
  }

  const checkIds = [
    ...runPerformanceChecks(fixture.desktopPageSpeed, fixture.mobilePageSpeed),
    ...runNetworkEngagementChecks(fixture.networkFailures),
    ...runOverlayBlockerChecks('cta', fixture.overlay, 'Start free'),
  ].map((flag) => flag.checkId)
  const flowCheckId = flowCheckIdForStatus('dead_end')
  if (flowCheckId) checkIds.push(flowCheckId)
  if (fixture.slowReplay) {
    checkIds.push(...runSlowReplayChecks(fixture.slowReplay).map((flag) => flag.checkId))
  }

  for (const layoutCase of fixture.mobileLayoutCases ?? []) {
    const metrics: CaptureMetrics = {
      mobilePrimaryCtaTopPx: layoutCase.mobilePrimaryCtaTopPx,
      mobilePrimaryCtaText: layoutCase.mobilePrimaryCtaText,
      mobileViewportHeight: layoutCase.mobileViewportHeight,
      competingPrimaryCtaCount: 0,
      competingPrimaryCtaLabels: [],
      stuckLoadingIndicator: false,
      stuckLoadingLabel: null,
      uniqueFontFamilies: 0,
      fontFamilySample: [],
      buttonBorderRadii: [],
      motionIgnoresReducedPreference: false,
      motionSampleLabel: null,
      inputsBelow16px: [],
    }
    const actualLayout = runLayoutChecks(metrics).map((flag) => flag.checkId).sort()
    const expectedLayout = [...layoutCase.expectedCheckIds].sort()
    if (actualLayout.join(',') !== expectedLayout.join(',')) {
      failures.push(
        `mobile layout "${layoutCase.name}" mismatch: expected ${expectedLayout.join(', ') || 'none'}, got ${actualLayout.join(', ') || 'none'}`
      )
    }
  }

  const actual = [...new Set(checkIds)].sort()
  const expected = [...fixture.expectedCheckIds].sort()
  if (actual.join(',') !== expected.join(',')) {
    failures.push(`non-html regression mismatch: expected ${expected.join(', ')}, got ${actual.join(', ')}`)
  }
  return failures
}

async function main() {
  const htmlResult = await evaluateHtmlFixtures()
  const demoFailures = await evaluateDemoRepair()
  const nonHtmlFailures = evaluateNonHtmlFixture()
  const failures = [...htmlResult.failures, ...demoFailures, ...nonHtmlFailures]

  console.log('FixFlags accuracy eval\n')
  console.log(`HTML gate fixtures: ${accuracyGateFixtures().length}`)
  console.log(`Gold fixtures: ${goldAccuracyFixtures().length}`)
  console.log(`Total flags across fixtures: ${htmlResult.totalFlags}`)
  console.log(`  IMPORTANT/CRITICAL: ${htmlResult.totalImportant}`)
  console.log(`  POLISH: ${htmlResult.totalPolish}`)
  console.log(`Gold-tier flags: ${htmlResult.goldTotalFlags} (IMPORTANT/CRITICAL: ${htmlResult.goldImportantFlags})`)
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
