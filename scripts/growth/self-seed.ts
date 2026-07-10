#!/usr/bin/env -S npx tsx -r dotenv/config
/**
 * Self-seed the knowledge graph by batch-auditing ~50 real public URLs.
 *
 * Creates Audit records with status=QUEUED and source=SEED, then enqueues
 * them to the BullMQ audit queue at 1-per-5s to avoid overwhelming the
 * worker.
 *
 * Idempotent: skips URLs that already have a recent (≤24h) SEED audit.
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

  // Marketing / landing pages
  'https://calm.com',
  'https://headspace.com',
  'https://grammarly.com',
  'https://wix.com',
  'https://wordpress.com',
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
  errors: Array<{ url: string; error: string }>
}

export async function runSelfSeed(): Promise<SelfSeedResult> {
  const dryRun = process.argv.includes('--dry-run')
  const result: SelfSeedResult = { attempted: 0, created: 0, skipped: 0, failed: 0, errors: [] }

  console.log(`[self-seed] ${dryRun ? 'DRY RUN — ' : ''}starting with ${SEED_URLS.length} URLs`)

  const queue = getAuditQueue()

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

      await sleep(RATE_LIMIT_MS)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[self-seed]   FAIL  ${display} — ${msg}`)
      result.failed++
      result.errors.push({ url, error: msg })
    }
  }

  console.log(
    `[self-seed] done — ` +
      `${result.created} created, ${result.skipped} skipped, ${result.failed} failed ` +
      `(${result.attempted} total)`
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
