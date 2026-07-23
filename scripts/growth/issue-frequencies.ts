#!/usr/bin/env -S npx tsx -r dotenv/config
/**
 * Rollup script: recompute denormalized counters on graph:Issue from
 * graph:IssueOccurrence rows.
 *
 * - occurrenceCount: total observations of this issue
 * - siteCount:       distinct sites where the issue appeared
 * - frameworkCount:  distinct (framework, site) pairs — a cheap proxy for
 *                    "how spread across frameworks" without listing them
 * - examples:        top 3 anonymized examples (rebuild from occurrences)
 *
 * Run nightly via the existing self-hosted scheduler in lib/queue/. Manual:
 *   DOTENV_CONFIG_PATH=.env.local npm run growth:rollup-issues
 *
 * Idempotent. Safe to re-run any number of times.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

import { prisma } from '@/lib/db'
import { runIssueRollup } from '@/lib/growth/issue-rollup'

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  console.log(
    `[rollup-issues] ${dryRun ? 'DRY RUN — ' : ''}starting ${new Date().toISOString()}`,
  )

  const t0 = Date.now()
  const result = dryRun ? { issues: 0, examples: 0 } : await runIssueRollup()
  const { issues, examples } = result
  console.log(`[rollup-issues] aggregates updated for ${issues} issue(s)`)
  console.log(`[rollup-issues] examples rebuilt for ${examples} issue(s)`)

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[rollup-issues] done in ${elapsed}s`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('[rollup-issues] fatal:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
