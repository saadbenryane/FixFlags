#!/usr/bin/env -S npx tsx -r dotenv/config
/**
 * Self-seed the knowledge graph by batch-auditing ~50 real public URLs.
 *
 * Creates Audit records with status=QUEUED and source=SEED, then enqueues
 * them to the BullMQ audit queue at 1-per-5s to avoid overwhelming the
 * worker.
 *
 * After queueing all jobs, polls each one to completion, runs the issue
 * rollup script, and reports which issues have crossed the MIN_SAMPLE_SIZE
 * threshold so they can activate programmatic pages.
 *
 * Idempotent: skips URLs that already have a recent (24h) SEED audit.
 *
 * Manual run:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/growth/self-seed.ts
 *
 * Dry run (preview URLs without auditing):
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/growth/self-seed.ts --dry-run
 *
 * Also exported as runSelfSeed() for the in-process scheduler.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { pollAuditUntilDone } from '@/lib/audit/poll-audit'
import { MIN_SAMPLE_SIZE } from '@/lib/graph/queries'

const RATE_LIMIT_MS = 5_000
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1_000

const SEED_URLS: string[] = [
  // AI / no-code builders (lovable, bolt, v0 showcases)
  'https://lovable.dev',
  'https://bolt.new',
  'https://v0.dev',
  'https://chat.openai.com',
  'https://claude.ai',
  'https://perplexity.ai',
  'https://replit.com',
  'https://codesandbox.io',
  'https://stackblitz.com',
  'https://cursor.sh',
  'https://windsurf.ai',
  'https://boltai.com',

  // SaaS / dev tools
  'https://vercel.com',
  'https://netlify.com',
  'https://railway.app',
  'https://render.com',
  'https://supabase.com',
  'https://clerk.com',
  'https://sentry.io',
  'https://linear.app',
  'https://cal.com',
  'https://plane.so',
  'https://excalidraw.com',
  'https://trigger.dev',
  'https://dub.co',
  'https://openpanel.dev',
  'https://documenso.com',
  'https://formbricks.com',

  // Analytics
  'https://plausible.io',
  'https://usefathom.com',
  'https://simpleanalytics.com',
  'https://umami.is',
  'https://posthog.com',

  // E-commerce / monetization
  'https://shopify.com',
  'https://gumroad.com',
  'https://lemonsqueezy.com',
  'https://bigcartel.com',

  // Portfolio / personal
  'https://brittanychiang.com',
  'https://joshwcomeau.com',
  'https://rauno.me',
  'https://leerob.io',
  'https://nikitababin.com',
  'https://brianlovin.com',

  // Design / creative tools
  'https://figma.com',
  'https://canva.com',
  'https://webflow.com',
  'https://framer.com',
  'https://squarespace.com',

  // Productivity / collaboration
  'https://notion.so',
  'https://airtable.com',
  'https://miro.com',
  'https://clickup.com',
  'https://height.app',
  'https://loom.com',

  // Marketing / landing pages
  'https://calm.com',
  'https://headspace.com',
  'https://grammarly.com',
  'https://wix.com',
  'https://wordpress.com',
  'https://typeform.com',
  'https://mailchimp.com',
  'https://intercom.com',
]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function hasRecentSeedAudit(url: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS)
  const existing = await prisma.audit.findFirst({
    where: {
      url,
      source: 'SEED',
      status: { not: 'FAILED' },
      createdAt: { gte: cutoff },
    },
    select: { id: true, status: true, createdAt: true },
  })
  return existing !== null
}

export interface SelfSeedResult {
  attempted: number
  created: number
  skipped: number
  failed: number
  polled: number
  completed: number
  timedOut: number
  errors: Array<{ url: string; error: string }>
  issueRollup: { issues: number; examples: number } | null
  readyForProgrammatic: number
}

async function runIssueRollup(): Promise<{ issues: number; examples: number }> {
  const rows = await prisma.$queryRaw<
    Array<{ checkId: string; occurrence_count: bigint; site_count: bigint; framework_count: bigint }>
  >`
    SELECT
      i."checkId" AS "checkId",
      COUNT(io.id)::bigint                                   AS occurrence_count,
      COUNT(DISTINCT io."siteId")::bigint                     AS site_count,
      COUNT(DISTINCT st."technologyId")::bigint               AS framework_count
    FROM "graph_issue" i
    LEFT JOIN "graph_issue_occurrence" io ON io."issueId" = i.id
    LEFT JOIN "graph_site_technology"  st ON st."siteId"   = io."siteId"
    GROUP BY i."checkId"
  `

  let issues = 0
  for (const row of rows) {
    await prisma.issue.updateMany({
      where: { checkId: row.checkId },
      data: {
        occurrenceCount: Number(row.occurrence_count),
        siteCount: Number(row.site_count),
        frameworkCount: Number(row.framework_count),
      },
    })
    issues += 1
  }

  const checkIds = await prisma.issue.groupBy({ by: ['checkId'] })
  let examples = 0
  for (const { checkId } of checkIds) {
    const ex = await prisma.$queryRaw<
      Array<{ hostname: string; pageRole: string; severity: string }>
    >`
      SELECT s.hostname AS hostname,
             COALESCE(p.role, 'other') AS "pageRole",
             f.severity AS severity
      FROM "graph_issue_occurrence" io
      JOIN "graph_issue" i ON i.id = io."issueId"
      JOIN "graph_site" s ON s.id = io."siteId"
      JOIN "flags" f ON f.id = io."flagId"
      LEFT JOIN "graph_page" p ON p."siteId" = s.id AND p.url = f."pageUrl"
      WHERE i."checkId" = ${checkId}
      ORDER BY io."observedAt" DESC
      LIMIT 3
    `
    await prisma.issue.updateMany({
      where: { checkId },
      data: {
        examples: ex.map((e) => ({
          hostname: e.hostname.replace(/^www\./, ''),
          pageRole: e.pageRole,
          severity: e.severity,
        })),
      },
    })
    examples += 1
  }

  return { issues, examples }
}

async function reportProgrammaticReadiness(): Promise<number> {
  const issuesReady = await prisma.issue.count({
    where: { siteCount: { gte: MIN_SAMPLE_SIZE } },
  })

  if (issuesReady > 0) {
    const top = await prisma.issue.findMany({
      where: { siteCount: { gte: MIN_SAMPLE_SIZE } },
      orderBy: { siteCount: 'desc' },
      take: 5,
      select: { checkId: true, problemTemplate: true, siteCount: true },
    })
    console.log(`[self-seed]   issues ready for programmatic pages (>= ${MIN_SAMPLE_SIZE} sites):`)
    for (const i of top) {
      console.log(`   - ${i.checkId}: ${i.siteCount} sites — "${i.problemTemplate.slice(0, 80)}"`)
    }
  }

  const sites = await prisma.site.count()
  const totalTech = await prisma.siteTechnology.groupBy({
    by: ['siteId'],
    _count: true,
  })
  const sitesWithTech = totalTech.filter((st) => st._count > 0).length

  console.log(`[self-seed]   graph summary: ${sites} sites, ${sitesWithTech} with tech detected`)
  return issuesReady
}

export async function runSelfSeed(): Promise<SelfSeedResult> {
  const dryRun = process.argv.includes('--dry-run')
  const result: SelfSeedResult = {
    attempted: 0, created: 0, skipped: 0, failed: 0,
    polled: 0, completed: 0, timedOut: 0,
    errors: [],
    issueRollup: null,
    readyForProgrammatic: 0,
  }

  console.log(`[self-seed] ${dryRun ? 'DRY RUN — ' : ''}starting with ${SEED_URLS.length} URLs`)

  const queue = getAuditQueue()
  const createdAuditIds: Array<{ auditId: string; url: string; display: string }> = []

  // ── Phase 1: Queue ───────────────────────────────────────────────────
  for (const rawUrl of SEED_URLS) {
    result.attempted++

    const normalized = normalizeAuditUrl(rawUrl)
    if (!normalized.ok) {
      console.warn(`[self-seed]   SKIP  ${rawUrl} — ${normalized.error}`)
      result.skipped++
      continue
    }
    const url = normalized.url
    const display = url.replace(/^https?:\/\//, '').replace(/\/$/, '')

    const recent = await hasRecentSeedAudit(url)
    if (recent) {
      console.log(`[self-seed]   SKIP  ${display} — recent SEED audit exists`)
      result.skipped++
      continue
    }

    if (dryRun) {
      console.log(`[self-seed]   WOULD ${display}`)
      continue
    }

    try {
      const audit = await prisma.audit.create({
        data: {
          url,
          status: 'QUEUED',
          progress: 5,
          source: 'SEED',
          includeAi: false,
        },
        select: { id: true },
      })

      await queue.add(
        'audit',
        { auditId: audit.id },
        {
          jobId: audit.id,
          attempts: 1,
          delay: 0,
          removeOnComplete: 100,
          removeOnFail: 500,
        }
      )

      console.log(`[self-seed]   OK    ${display} — audit ${audit.id.slice(0, 8)}`)
      result.created++
      createdAuditIds.push({ auditId: audit.id, url, display })

      await sleep(RATE_LIMIT_MS)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[self-seed]   FAIL  ${display} — ${msg}`)
      result.failed++
      result.errors.push({ url, error: msg })
    }
  }

  console.log(
    `[self-seed] phase 1 done — ` +
      `${result.created} created, ${result.skipped} skipped, ${result.failed} failed ` +
      `(${result.attempted} total)`
  )

  // ── Phase 2: Poll ───────────────────────────────────────────────────
  if (!dryRun && createdAuditIds.length > 0) {
    console.log(`[self-seed] phase 2 — polling ${createdAuditIds.length} audits to completion...`)

    for (const { auditId, url, display } of createdAuditIds) {
      result.polled++

      try {
        const out = await pollAuditUntilDone({
          auditId,
          timeoutMs: 120_000,
          intervalMs: 3_000,
        })

        if (out.status === 'COMPLETED') {
          result.completed++
          const msg = out.timedOut ? ' completed (barely within window)' : ' completed'
          console.log(`[self-seed]   OK    ${display}${msg}`)
        } else {
          console.warn(`[self-seed]   FAIL  ${display} — status: ${out.status}`)
          result.failed++
          result.errors.push({ url, error: `Audit ended with status ${out.status}` })
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`[self-seed]   FAIL  ${display} — poll error: ${msg}`)
        result.failed++
        result.errors.push({ url, error: msg })
      }
    }
  }

  result.timedOut = result.polled - result.completed

  console.log(
    `[self-seed] phase 2 done — ${result.completed} completed, ` +
      `${result.timedOut} timed/errored out`
  )

  // ── Phase 3: Rollup ─────────────────────────────────────────────────
  if (!dryRun && result.completed > 0) {
    console.log(`[self-seed] phase 3 — running issue rollup...`)
    try {
      result.issueRollup = await runIssueRollup()
      console.log(
        `[self-seed]   rollup done — ${result.issueRollup.issues} issues, ${result.issueRollup.examples} examples`
      )
    } catch (error) {
      console.error('[self-seed]   rollup failed:', error)
    }
  }

  // ── Phase 4: Report ─────────────────────────────────────────────────
  if (!dryRun) {
    console.log(`[self-seed] phase 4 — programmatic page readiness...`)
    try {
      result.readyForProgrammatic = await reportProgrammaticReadiness()
    } catch (error) {
      console.error('[self-seed]   readiness report failed:', error)
    }
  }

  console.log(
    `[self-seed] done — ` +
      `${result.created} created, ${result.skipped} skipped, ${result.failed} failed, ` +
      `${result.completed} completed, ${result.readyForProgrammatic} issues above threshold`
  )
  return result
}

const isDirectRun = process.argv[1]?.endsWith('self-seed.ts')
if (isDirectRun) {
  runSelfSeed()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error('[self-seed] fatal:', err)
      await prisma.$disconnect()
      process.exit(1)
    })
}
