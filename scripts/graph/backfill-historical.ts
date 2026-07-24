#!/usr/bin/env -S npx tsx -r dotenv/config
/**
 * One-shot backfill of the knowledge graph from historical Audit rows.
 *
 * Iterates every completed audit in the database and calls
 * `persistAuditToGraph()` for each. Safe to interrupt and re-run —
 * persist.ts is idempotent thanks to the unique guard on
 * graph_issue_occurrence.flagId and the Site upsert.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npm run graph:backfill
 *   # or with a limit for a smoke test:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config \
 *     scripts/graph/backfill-historical.ts --limit 10
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

import { prisma } from '../../lib/db.js'
import { persistAuditToGraph, classifyPageRole } from '../../lib/graph/persist.js'
import type { FlagSnapshot } from '../../lib/graph/types.js'

function parseArgs(): { limit: number | null; dryRun: boolean } {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const limit =
    limitIdx !== -1 && args[limitIdx + 1] ? Number(args[limitIdx + 1]) : null
  return { limit: Number.isFinite(limit) ? limit : null, dryRun: args.includes('--dry-run') }
}

async function listCompletedAuditIds(limit: number | null): Promise<string[]> {
  const rows = await prisma.audit.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    take: limit ?? undefined,
  })
  return rows.map((r) => r.id)
}

/**
 * Build a SiteSnapshot + FlagSnapshot from a completed audit.
 * Reuses the same field mapping as lib/graph/snapshot.ts::persistAuditGraphSnapshot()
 * but reads directly from DB for the backfill context.
 */
async function loadFlagSnapshot(auditId: string): Promise<{
  snapshot: import('../../lib/graph/types.js').SiteSnapshot
  flags: FlagSnapshot[]
}> {
  const audit = await prisma.audit.findUniqueOrThrow({
    where: { id: auditId },
    include: {
      pages: { select: { url: true } },
      flags: {
        select: {
          id: true,
          checkId: true,
          rubric: true,
          fingerprint: true,
          problem: true,
          fix: true,
          pageUrl: true,
          agentPrompt: true,
          cursorPrompt: true,
          claudePrompt: true,
          windsurfPrompt: true,
          lovablePrompt: true,
          boltPrompt: true,
        },
      },
    },
  })

  const pageUrls = audit.pages.length > 0
    ? audit.pages.map((p) => p.url)
    : [audit.url]

  // Build page roles using shared classifier
  const pageRoles: Record<string, string> = {}
  for (const url of pageUrls) {
    try {
      pageRoles[url] = classifyPageRole(pageUrls, url)
    } catch {
      pageRoles[url] = 'other'
    }
  }

  return {
    snapshot: {
      rootUrl: audit.url,
      pageUrls,
      pageRoles,
      detectedTech: [],
      technologyDetectionComplete: false,
      industryGuess: null,
    },
    flags: audit.flags.map((f) => ({
      flagId: f.id,
      checkId: f.checkId,
      rubric: f.rubric,
      fingerprint: f.fingerprint,
      problem: f.problem,
      fix: f.fix,
      pageUrl: f.pageUrl,
      prompts: {
        generic: f.agentPrompt,
        cursor: f.cursorPrompt,
        claude: f.claudePrompt,
        windsurf: f.windsurfPrompt,
        lovable: f.lovablePrompt,
        bolt: f.boltPrompt,
      },
    })),
  }
}

async function main(): Promise<void> {
  const { limit, dryRun } = parseArgs()
  const ids = await listCompletedAuditIds(limit)
  console.log(
    `[backfill] ${dryRun ? 'DRY RUN — ' : ''}processing ${ids.length} completed audit(s)` +
      (limit ? ` (limit=${limit})` : ''),
  )

  let ok = 0
  let fail = 0
  const t0 = Date.now()

  for (const id of ids) {
    try {
      const { snapshot, flags } = await loadFlagSnapshot(id)
      if (dryRun) {
        console.log(
          `[backfill] would process audit=${id} url=${snapshot.rootUrl} flags=${flags.length}`,
        )
        ok += 1
        continue
      }
      const result = await persistAuditToGraph(id, snapshot, flags)
      ok += 1
      if (ok % 50 === 0) {
        console.log(
          `[backfill] ${ok}/${ids.length} processed (sites+=${result.siteId ? 1 : 0}, issues+=${result.issueIds.length})`,
        )
      }
    } catch (err) {
      fail += 1
      console.error(`[backfill] audit=${id} failed:`, err)
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[backfill] done in ${elapsed}s — ${ok} ok, ${fail} failed`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('[backfill] fatal:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
