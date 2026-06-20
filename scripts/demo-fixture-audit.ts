/**
 * Compare deterministic flags between demo baseline (/demo) and fixed fork (/demo/v1).
 * Run: tsx scripts/demo-fixture-audit.ts [baseUrl]
 * Example: tsx scripts/demo-fixture-audit.ts http://localhost:3000
 */
import { runDeterministicAudit } from '@/lib/audit/deterministic-audit'
import { buildExpertFixPrompt } from '@/lib/audit/flag-copy'

const BASE = process.argv[2]?.replace(/\/$/, '') ?? 'http://localhost:3000'

async function auditFixture(label: string, path: string) {
  const url = `${BASE}${path}`
  console.log(`\n=== ${label} (${url}) ===`)
  const { flags } = await runDeterministicAudit(url, { includeFlow: false })
  const sorted = [...flags].sort((a, b) => a.checkId.localeCompare(b.checkId))
  console.log(`Flags: ${sorted.length}`)
  for (const f of sorted) {
    console.log(`  [${f.severity}] ${f.checkId}: ${f.problem}`)
  }
  return sorted
}

async function main() {
  const baseline = await auditFixture('Baseline (original)', '/demo')
  const fixed = await auditFixture('Fixed (v1)', '/demo/v1')

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
