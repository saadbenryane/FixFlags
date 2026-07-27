/**
 * Accuracy adjudication tool — detailed JSON report for HTML fixtures.
 *
 *   npm run accuracy:adjudicate
 *   npx tsx scripts/accuracy-adjudicate.ts --json
 */
import { existsSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import {
  ACCURACY_FIXTURE_DIR,
  accuracyGateFixtures,
  type AccuracyFixtureTier,
  type AccuracyHtmlFixture,
} from '@/lib/audit/accuracy-corpus'
import { runAccuracyFixtureChecks } from '@/lib/audit/fixture-html'
import { rankFlagsByPriority, type RankableFlag } from '@/lib/audit/priority-flags'

interface FixtureResult {
  file: string
  url: string
  tier: AccuracyFixtureTier
  status: 'pass' | 'fail' | 'missing'
  flagCount: number
  criticalCount: number
  importantCount: number
  polishCount: number
  top3: string[]
  allFlagIds: string[]
  expectedTop3: string[]
  missingExpected: string[]
  unexpectedPresent: string[]
  knownFalsePositivesStillPresent: string[]
  maxImportantFalseBlockers: number
  importantFalseBlockers: number
}

interface AdjudicationReport {
  timestamp: string
  totalFixtures: number
  passed: number
  failed: number
  goldImportantTotal: number
  fixtures: FixtureResult[]
}

function countBySeverity(flags: RankableFlag[]) {
  let critical = 0, important = 0, polish = 0
  for (const f of flags) {
    if (f.severity === 'CRITICAL') critical++
    else if (f.severity === 'IMPORTANT') important++
    else if (f.severity === 'POLISH') polish++
  }
  return { critical, important, polish }
}

function countImportantFalseBlockers(flags: RankableFlag[], tier: AccuracyFixtureTier): number {
  if (tier === 'broken' || tier === 'control' || tier === 'structural') return 0
  return flags.filter((f) => f.severity === 'CRITICAL' || f.severity === 'IMPORTANT').length
}

async function adjudicateFixture(fixture: AccuracyHtmlFixture): Promise<FixtureResult> {
  if (!existsSync(`${ACCURACY_FIXTURE_DIR}/${fixture.file}`)) {
    return {
      file: fixture.file,
      url: fixture.url,
      tier: fixture.tier,
      status: 'missing',
      flagCount: 0,
      criticalCount: 0,
      importantCount: 0,
      polishCount: 0,
      top3: [],
      allFlagIds: [],
      expectedTop3: fixture.expectedTop3,
      missingExpected: fixture.expectedTop3,
      unexpectedPresent: [],
      knownFalsePositivesStillPresent: [],
      maxImportantFalseBlockers: fixture.maxImportantFalseBlockers,
      importantFalseBlockers: 0,
    }
  }

  const { flags } = await runAccuracyFixtureChecks(fixture)
  const sorted = [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId)) as RankableFlag[]
  const top3 = rankFlagsByPriority(sorted, [], 3).map((r) => r.flag.checkId ?? '')
  const flagIds = new Set(flags.map((f) => f.checkId))
  const { critical, important, polish } = countBySeverity(sorted)
  const importantFalseBlockers = countImportantFalseBlockers(sorted, fixture.tier)

  const missingExpected = fixture.expectedTop3.filter((id) => !top3.includes(id))
  const unexpectedPresent = fixture.knownFalsePositives.filter((id) => flagIds.has(id))

  const failed = importantFalseBlockers > fixture.maxImportantFalseBlockers ||
    missingExpected.length > 0 ||
    unexpectedPresent.length > 0

  return {
    file: fixture.file,
    url: fixture.url,
    tier: fixture.tier,
    status: failed ? 'fail' : 'pass',
    flagCount: flags.length,
    criticalCount: critical,
    importantCount: important,
    polishCount: polish,
    top3,
    allFlagIds: [...flagIds].sort(),
    expectedTop3: fixture.expectedTop3,
    missingExpected,
    unexpectedPresent,
    knownFalsePositivesStillPresent: unexpectedPresent,
    maxImportantFalseBlockers: fixture.maxImportantFalseBlockers,
    importantFalseBlockers,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const jsonMode = args.includes('--json')
  const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : null

  const fixtures = accuracyGateFixtures()
  const results: FixtureResult[] = []
  let goldImportantTotal = 0

  for (const fixture of fixtures) {
    const result = await adjudicateFixture(fixture)
    results.push(result)
    if (fixture.tier === 'gold') goldImportantTotal += result.importantFalseBlockers
  }

  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length

  const report: AdjudicationReport = {
    timestamp: new Date().toISOString(),
    totalFixtures: fixtures.length,
    passed,
    failed,
    goldImportantTotal,
    fixtures: results,
  }

  if (jsonMode || outFile) {
    const json = JSON.stringify(report, null, 2)
    if (outFile) {
      writeFileSync(outFile, json)
      console.log(`Report written to ${outFile}`)
    } else {
      console.log(json)
    }
  } else {
    // Pretty table output
    console.log('\nFixFlags Accuracy Adjudication Report')
    console.log(`Timestamp: ${report.timestamp}`)
    console.log(`Fixtures: ${report.totalFixtures} | Passed: ${report.passed} | Failed: ${report.failed}`)
    console.log(`Gold IMPORTANT total: ${report.goldImportantTotal}\n`)

    const tierEmoji: Record<string, string> = {
      gold: '🥇', builder: '🔨', personal: '👤', broken: '💥', structural: '🏗️', control: '🎮',
    }

    for (const r of results) {
      const emoji = tierEmoji[r.tier] ?? '❓'
      const status = r.status === 'pass' ? '✅' : r.status === 'missing' ? '⚠️' : '❌'
      console.log(`${status} ${emoji} ${r.file} (${r.url})`)
      console.log(`   Flags: ${r.flagCount} total | ${r.criticalCount} CRITICAL | ${r.importantCount} IMPORTANT | ${r.polishCount} POLISH`)
      console.log(`   Top-3: ${r.top3.join(', ') || '(none)'}`)
      if (r.missingExpected.length > 0) {
        console.log(`   Missing expected: ${r.missingExpected.join(', ')}`)
      }
      if (r.knownFalsePositivesStillPresent.length > 0) {
        console.log(`   FP still present: ${r.knownFalsePositivesStillPresent.join(', ')}`)
      }
      if (r.importantFalseBlockers > r.maxImportantFalseBlockers) {
        console.log(`   IMPORTANT blockers: ${r.importantFalseBlockers} > max ${r.maxImportantFalseBlockers}`)
      }
      console.log()
    }
  }

  if (report.failed > 0 || report.goldImportantTotal > 0) {
    process.exit(1)
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
