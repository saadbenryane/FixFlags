import { runDeterministicAudit } from '../lib/audit/deterministic-audit.js'

const URLs = [
  { url: 'https://linear.app', category: 'SaaS project management' },
  { url: 'https://vercel.com', category: 'Developer platform' },
  { url: 'https://github.com', category: 'Developer platform' },
  { url: 'https://stripe.com', category: 'Payments/B2B' },
  { url: 'https://tailwindcss.com', category: 'Developer docs/framework' },
]

for (const { url, category } of URLs) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Scanning: ${url} [${category}]`)
  console.log('='.repeat(60))
  try {
    const { flags } = await runDeterministicAudit(url, { includeFlow: false })
    console.log(`Total flags: ${flags.length}`)
    // Group by rubric
    const byRubric = {}
    for (const f of flags) {
      ;(byRubric[f.rubric] ??= []).push(f)
    }
    for (const [rubric, rFlags] of Object.entries(byRubric)) {
      console.log(`\n  [${rubric}] (${rFlags.length} flags)`)
      for (const f of rFlags) {
        console.log(`    ${f.severity} ${f.checkId}: ${f.problem}`)
      }
    }
  } catch (err) {
    console.error(`  ERROR: ${err.message}`)
  }
}
