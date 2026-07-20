import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config.mjs'

export function generateReport(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const report = {
    timestamp,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.grade === 'pass').length,
      failed: results.filter((r) => r.grade === 'fail').length,
      avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    },
    results,
  }

  mkdirSync(config.reportDir, { recursive: true })
  const reportPath = join(config.reportDir, `eval-${timestamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  return { report, reportPath }
}

export function printSummary(report) {
  console.log('\n=== Agent Evaluation Summary ===')
  console.log(`Total: ${report.summary.total}`)
  console.log(`Passed: ${report.summary.passed}`)
  console.log(`Failed: ${report.summary.failed}`)
  console.log(`Avg Duration: ${report.summary.avgDuration.toFixed(0)}ms`)
  console.log('\nResults:')
  for (const result of report.results) {
    const icon = result.grade === 'pass' ? '✓' : '✗'
    console.log(`  ${icon} ${result.caseId} (${result.duration}ms)`)
    if (result.error) {
      console.log(`    Error: ${result.error}`)
    }
  }
}
