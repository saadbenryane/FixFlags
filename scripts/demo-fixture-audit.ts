/**
 * Demo fixture regression loop — compare baseline (/demo) vs fixed fork (/demo/v1).
 *
 * Local-first (default): fetches rendered Next.js pages from dev server.
 * Offline: static HTML from fixture definitions (no dev server; fastest).
 *
 * Run:
 *   npm run demo:audit              # live localhost (needs npm run dev)
 *   npm run demo:audit:offline      # offline fixture HTML
 *   tsx scripts/demo-fixture-audit.ts [baseUrl] [--offline] [--production]
 *
 * Scoped flags exclude site-level noise (no-https on localhost, sitemap, PageSpeed, etc.).
 * Use --production for full production audit against fixflags.com (post-deploy smoke test).
 */
import { runDeterministicAudit } from '@/lib/audit/deterministic-audit'
import { buildExpertFixPrompt } from '@/lib/audit/flag-copy'
import { compareDemoFixtures } from '@/lib/demo/audit-demo-fixtures'
import { DEMO_LOCAL_DEV_BASE } from '@/lib/demo/demo-audit-scope'
import type { DeterministicFlag } from '@/lib/audit/checks'

const argv = process.argv.slice(2)
const OFFLINE = argv.includes('--offline')
const PRODUCTION = argv.includes('--production')
const args = argv.filter((a) => !a.startsWith('--'))
const BASE = args[0]?.replace(/\/$/, '') ?? DEMO_LOCAL_DEV_BASE

function printFlags(label: string, url: string, flags: DeterministicFlag[], modeLabel: string) {
  console.log(`\n=== ${label} (${url}) [${modeLabel}] ===`)
  console.log(`Flags: ${flags.length}`)
  for (const f of flags) {
    console.log(`  [${f.severity}] ${f.checkId}: ${f.problem}`)
  }
}

function printSummary(
  baseline: DeterministicFlag[],
  fixed: DeterministicFlag[],
  cleared: string[],
  remaining: string[]
) {
  console.log('\n=== Regression summary (in-scope fixture flags) ===')
  console.log(`Baseline flags: ${baseline.length}`)
  console.log(`v1 flags: ${fixed.length}`)
  console.log(`Cleared by v1: ${cleared.length}`)
  if (cleared.length) console.log(`  ${cleared.join(', ')}`)
  if (remaining.length) {
    console.log(`Still failing on v1: ${remaining.join(', ')}`)
  } else {
    console.log('v1 is clean — all baseline issues addressed.')
  }
}

async function auditProductionFixture(label: string, path: string) {
  const url = `${BASE}${path}`
  console.log(`\n=== ${label} (${url}) [production full audit] ===`)
  const { flags } = await runDeterministicAudit(url, { includeFlow: false })
  const sorted = [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId))
  console.log(`Flags: ${sorted.length}`)
  for (const f of sorted) {
    console.log(`  [${f.severity}] ${f.checkId}: ${f.problem}`)
  }
  return sorted
}

async function main() {
  console.log('Demo fixture audit\n')

  if (PRODUCTION) {
    console.log('Mode: production full audit (unscoped; for post-deploy smoke test)\n')
    const baseline = await auditProductionFixture('Baseline (original)', '/demo')
    const fixed = await auditProductionFixture('Fixed (v1)', '/demo/v1')
    const baselineIds = new Set(baseline.map((f) => f.checkId))
    const fixedIds = new Set(fixed.map((f) => f.checkId))
    printSummary(baseline, fixed, [...baselineIds].filter((id) => !fixedIds.has(id)), [...fixedIds])
    if (fixed.length > 0) process.exitCode = 1
    return
  }

  const mode = OFFLINE ? 'offline' : 'live'
  const modeLabel = OFFLINE ? 'offline fixture HTML' : 'live localhost'
  console.log(`Mode: ${modeLabel}`)
  if (mode === 'live') console.log(`Base: ${BASE} (start with npm run dev)\n`)
  else console.log('Base: fixture definitions (no dev server)\n')

  const comparison = await compareDemoFixtures({
    mode,
    baseUrl: mode === 'live' ? BASE : undefined,
  })

  printFlags('Baseline (original)', comparison.baseline.url, comparison.baseline.flags, modeLabel)
  printFlags('Fixed (v1)', comparison.fixed.url, comparison.fixed.flags, modeLabel)
  printSummary(
    comparison.baseline.flags,
    comparison.fixed.flags,
    comparison.clearedCheckIds,
    comparison.remainingCheckIds
  )

  if (comparison.baseline.flags.length > 0) {
    console.log('\n=== Sample expert prompt (first baseline flag) ===')
    const sample = comparison.baseline.flags[0]
    console.log(
      buildExpertFixPrompt({
        id: 'sample',
        checkId: sample.checkId,
        rubric: sample.rubric,
        severity: sample.severity,
        problem: sample.problem,
        evidence: sample.evidence,
        fix: sample.fix,
      })
    )
  }

  if (comparison.fixed.flags.length > 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
