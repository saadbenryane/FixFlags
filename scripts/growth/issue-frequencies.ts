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

interface CountRow {
  id: string
  occurrence_count: bigint
  site_count: bigint
  framework_count: bigint
}

async function recomputeIssueAggregates(): Promise<number> {
  // Single query that returns all three counts per issue in one sweep.
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT
      i.id AS id,
      COUNT(io.id)::bigint                          AS occurrence_count,
      COUNT(DISTINCT io."siteId")::bigint           AS site_count,
      COUNT(DISTINCT st."technologyId")::bigint     AS framework_count
    FROM "graph_issue" i
    LEFT JOIN "graph_issue_occurrence" io ON io."issueId" = i.id
    LEFT JOIN "graph_site_technology"  st ON st."siteId"   = io."siteId"
    GROUP BY i.id
  `

  let updated = 0
  for (const row of rows) {
    await prisma.issue.update({
      where: { id: row.id },
      data: {
        occurrenceCount: Number(row.occurrence_count),
        siteCount: Number(row.site_count),
        frameworkCount: Number(row.framework_count),
      },
    })
    updated += 1
  }
  return updated
}

async function rebuildExamples(): Promise<number> {
  const issueIds = await prisma.issue.findMany({ select: { id: true } })
  let updated = 0

  for (const { id } of issueIds) {
    const examples = await prisma.$queryRaw<
      Array<{ hostname: string; pageRole: string; severity: string }>
    >`
      SELECT s.hostname AS hostname,
             COALESCE(p.role, 'other') AS "pageRole",
             f.severity AS severity
      FROM "graph_issue_occurrence" io
      JOIN "graph_site" s ON s.id = io."siteId"
      JOIN "flags" f ON f.id = io."flagId"
      LEFT JOIN "graph_page" p
        ON p."siteId" = s.id AND p.url = f."pageUrl"
      WHERE io."issueId" = ${id}
      ORDER BY io."observedAt" DESC
      LIMIT 3
    `
    await prisma.issue.update({
      where: { id },
      data: {
        examples: examples.map((e) => ({
          hostname: e.hostname.replace(/^www\./, ''),
          pageRole: e.pageRole,
          severity: e.severity,
        })),
      },
    })
    updated += 1
  }
  return updated
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  console.log(
    `[rollup-issues] ${dryRun ? 'DRY RUN — ' : ''}starting ${new Date().toISOString()}`,
  )

  const t0 = Date.now()
  const issues = dryRun ? 0 : await recomputeIssueAggregates()
  console.log(`[rollup-issues] aggregates updated for ${issues} issue(s)`)

  const examples = dryRun ? 0 : await rebuildExamples()
  console.log(`[rollup-issues] examples rebuilt for ${examples} issue(s)`)

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[rollup-issues] done in ${elapsed}s`)
}

/**
 * Callable entrypoint for the in-process scheduler
 * (lib/queue/recovery-scheduler.ts). Returns counters instead of exiting the
 * process — the CLI wrapper below handles process lifecycle for manual runs.
 */
export async function runIssueRollup(): Promise<{ issues: number; examples: number }> {
  const issues = await recomputeIssueAggregates()
  const examples = await rebuildExamples()
  return { issues, examples }
}

// Only run as a CLI entrypoint when invoked directly (npm run growth:rollup-issues).
// When imported by the in-process scheduler (lib/queue/recovery-scheduler.ts),
// `runIssueRollup()` below is called instead — no process.exit, no dotenv reload.
const isDirectRun = process.argv[1]?.endsWith('issue-frequencies.ts')
if (isDirectRun) {
  main()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error('[rollup-issues] fatal:', err)
      await prisma.$disconnect()
      process.exit(1)
    })
}
