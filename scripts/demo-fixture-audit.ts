/**
 * Compare deterministic flags between demo baseline (/demo) and fixed fork (/demo/v1).
 *
 * Run: tsx scripts/demo-fixture-audit.ts [baseUrl] [--offline]
 *
 * Examples:
 *   tsx scripts/demo-fixture-audit.ts https://fixflags.com
 *   tsx scripts/demo-fixture-audit.ts https://fixflags.com --offline  (pre-deploy fixture HTML)
 *   tsx scripts/demo-fixture-audit.ts http://localhost:3000  (needs npm run dev)
 */
import { runDeterministicAudit } from '@/lib/audit/deterministic-audit'
import { buildExpertFixPrompt } from '@/lib/audit/flag-copy'
import { auditDemoFixturesOffline } from '@/lib/demo/audit-fixture-offline'
import { auditDemoUrl, isDemoLocalhostUrl } from '@/lib/demo/audit-demo-local'
import type { DeterministicFlag } from '@/lib/audit/checks'

const args = process.argv.slice(2).filter((a) => a !== '--offline')
const OFFLINE = process.argv.includes('--offline')
const BASE = args[0]?.replace(/\/$/, '') ?? 'https://fixflags.com'

async function auditFixture(label: string, path: string) {
  const url = `${BASE}${path}`
  console.log(`\n=== ${label} (${url}) ===`)
  const flags = isDemoLocalhostUrl(url)
    ? await auditDemoUrl(url)
    : (await runDeterministicAudit(url, { includeFlow: false })).flags
  const sorted = [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId))
  console.log(`Flags: ${sorted.length}`)
  for (const f of sorted) {
    console.log(`  [${f.severity}] ${f.checkId}: ${f.problem}`)
  }
  return sorted
}

function printSummary(baseline: DeterministicFlag[], fixed: DeterministicFlag[]) {
  const baselineIds = new Set(baseline.map((f) => f.checkId))
  const fixedIds = new Set(fixed.map((f) => f.checkId))
  const cleared = [...baselineIds].filter((id) => !fixedIds.has(id))
  const remaining = [...fixedIds]

  console.log('\n=== Regression summary ===')
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

async function main() {
  console.log('Batch audit test\n')

  if (OFFLINE) {
    console.log(`Mode: offline fixture HTML (origin ${BASE})\n`)
    const results = await auditDemoFixturesOffline(BASE)
    const baseline = results.original ?? []
    const fixed = results.v1 ?? []
    for (const [key, flags] of Object.entries(results)) {
      const path = key === 'original' ? '/demo' : '/demo/v1'
      console.log(`\n=== ${key} (${BASE}${path}) [offline] ===`)
      console.log(`Flags: ${flags.length}`)
      for (const f of flags.sort((a, b) => a.checkId.localeCompare(b.checkId))) {
        console.log(`  [${f.severity}] ${f.checkId}: ${f.problem}`)
      }
    }
    printSummary(baseline, fixed)
    return
  }

  const baseline = await auditFixture('Baseline (original)', '/demo')
  const fixed = await auditFixture('Fixed (v1)', '/demo/v1')
  printSummary(baseline, fixed)

  if (baseline.length > 0) {
    console.log('\n=== Sample expert prompt (first baseline flag) ===')
    const sample = baseline[0]
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
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
