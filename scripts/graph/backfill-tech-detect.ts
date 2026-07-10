#!/usr/bin/env -S npx tsx -r dotenv/config
/**
 * Backfill tech detection for existing completed audits.
 *
 * Iterates audits that have no `detectedTech` in their performanceData,
 * re-fetches the page HTML, runs detectTechnologies() + inferIndustry(),
 * and updates the audit's performanceData. Then calls
 * persistAuditGraphSnapshot() to populate SiteTechnology rows.
 *
 * Safe to interrupt and re-run — idempotent by design.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npm run growth:backfill-tech
 *   # or with a limit for a smoke test:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config \
 *     scripts/graph/backfill-tech-detect.ts --limit 10
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

import { prisma } from '../../lib/db.js'
import { detectTechnologies, inferIndustry } from '../../lib/audit/tech-detect.js'
import { safeFetchHtml } from '../../lib/audit/url.js'
import { persistAuditGraphSnapshot } from '../../lib/graph/snapshot.js'
import type { PageMetadata } from '../../lib/audit/metadata.js'

function parseArgs(): { limit: number | null; dryRun: boolean } {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const limit =
    limitIdx !== -1 && args[limitIdx + 1] ? Number(args[limitIdx + 1]) : null
  return { limit: Number.isFinite(limit) ? limit : null, dryRun: args.includes('--dry-run') }
}

/**
 * Find completed audits that don't have detectedTech in their primary page's
 * performanceData.
 */
async function findAuditsNeedingTechDetect(limit: number | null): Promise<Array<{
  id: string
  url: string
  performanceData: unknown
}>> {
  const rows = await prisma.audit.findMany({
    where: {
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
    take: limit ?? undefined,
    select: {
      id: true,
      url: true,
      pages: {
        take: 1,
        select: {
          performanceData: true,
        },
      },
    },
  })

  // Filter to audits where primary page has no detectedTech
  return rows
    .filter((r) => {
      const perf = r.pages[0]?.performanceData as Record<string, unknown> | null
      return !perf?.detectedTech
    })
    .map((r) => ({
      id: r.id,
      url: r.url,
      performanceData: r.pages[0]?.performanceData ?? {},
    }))
}

async function main(): Promise<void> {
  const { limit, dryRun } = parseArgs()
  const audits = await findAuditsNeedingTechDetect(limit)
  console.log(
    `[backfill-tech] ${dryRun ? 'DRY RUN — ' : ''}processing ${audits.length} audit(s)` +
      (limit ? ` (limit=${limit})` : ''),
  )

  let ok = 0
  let skip = 0
  let fail = 0
  const t0 = Date.now()

  for (const audit of audits) {
    try {
      // Re-fetch HTML for tech detection
      let html = ''
      try {
        const result = await safeFetchHtml(audit.url)
        html = result.html
      } catch {
        // If fetch fails, skip this audit
        skip += 1
        continue
      }

      const detectedTech = detectTechnologies(html)
      const hostname = new URL(audit.url).hostname
      const metadata = await prisma.auditPage.findFirst({
        where: { auditId: audit.id },
        select: { htmlMetadata: true },
      })
      const pageText = (metadata?.htmlMetadata as PageMetadata | null)?.pageText ?? ''
      const industryGuess = inferIndustry(hostname, pageText)

      if (detectedTech.length === 0 && !industryGuess) {
        skip += 1
        continue
      }

      if (dryRun) {
        console.log(
          `[backfill-tech] would process audit=${audit.id} url=${audit.url} tech=${detectedTech.length} industry=${industryGuess}`,
        )
        ok += 1
        continue
      }

      // Update the primary page's performanceData with tech detection
      const primaryPage = await prisma.auditPage.findFirst({
        where: { auditId: audit.id },
        select: { id: true, performanceData: true },
      })

      if (primaryPage) {
        const existingPerf = (primaryPage.performanceData as Record<string, unknown>) ?? {}
        await prisma.auditPage.update({
          where: { id: primaryPage.id },
          data: {
            performanceData: {
              ...existingPerf,
              detectedTech,
              industryGuess,
            } as never,
          },
        })
      }

      // Persist to knowledge graph
      await persistAuditGraphSnapshot(audit.id)

      ok += 1
      if (ok % 10 === 0) {
        console.log(
          `[backfill-tech] ${ok}/${audits.length} processed`,
        )
      }

      // Rate limit: 1 request per second to avoid hammering servers
      await new Promise((r) => setTimeout(r, 1000))
    } catch (err) {
      fail += 1
      console.error(`[backfill-tech] audit=${audit.id} failed:`, err)
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[backfill-tech] done in ${elapsed}s — ${ok} ok, ${skip} skipped, ${fail} failed`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('[backfill-tech] fatal:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
