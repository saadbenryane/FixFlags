/**
 * CTA flow regression: baseline (/demo) vs fixed fork (/demo/v1) on localhost.
 * Run: npm run demo:audit:flow  (needs npm run dev)
 */
import { compareDemoFlow } from '@/lib/demo/audit-demo-flow'
import { DEMO_LOCAL_DEV_BASE } from '@/lib/demo/demo-audit-scope'

const BASE = process.argv[2]?.replace(/\/$/, '') ?? DEMO_LOCAL_DEV_BASE

async function main() {
  console.log('Demo fixture flow audit\n')
  console.log(`Base: ${BASE}\n`)

  const comparison = await compareDemoFlow(BASE)

  for (const result of [comparison.baseline, comparison.fixed]) {
    console.log(`\n=== ${result.path} (${result.url}) ===`)
    console.log(`Flow status: ${result.flowStatus}`)
    console.log(`Flow flags: ${result.flags.length}`)
    for (const f of result.flags) {
      console.log(`  [${f.severity}] ${f.checkId}: ${f.problem}`)
    }
  }

  console.log('\n=== Flow regression summary ===')
  console.log(`Baseline flow flags: ${comparison.baseline.flags.length}`)
  console.log(`v1 flow flags: ${comparison.fixed.flags.length}`)
  if (comparison.clearedCheckIds.length) {
    console.log(`Cleared by v1: ${comparison.clearedCheckIds.join(', ')}`)
  }
  if (comparison.remainingCheckIds.length) {
    console.log(`Still failing on v1: ${comparison.remainingCheckIds.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log('v1 flow is clean.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
