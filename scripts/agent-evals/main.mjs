#!/usr/bin/env node
import { runAll } from './runner.mjs'
import { generateReport, printSummary } from './report.mjs'

async function main() {
  console.log('Running agent evaluations...\n')
  const results = await runAll()
  const { report } = generateReport(results)
  printSummary(report)

  const failed = results.filter((r) => r.grade === 'fail').length
  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Agent eval failed:', error)
  process.exit(1)
})
