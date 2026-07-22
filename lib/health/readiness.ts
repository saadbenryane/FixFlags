import { prisma } from '@/lib/db'
import { isAiProviderConfigured, isProdStorageConfigured } from '@/lib/env'
import { validateAuthEnv } from '@/lib/auth/env'
import { isBillingFullyConfigured } from '@/lib/billing/config'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { productWatchReadiness } from '@/lib/audit/project-watch'
import { createQueueRedis } from '@/lib/queue/redis'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { checkR2Connection } from '@/lib/storage/r2'

export type ReadinessSubsystemName =
  | 'database'
  | 'redis'
  | 'worker'
  | 'browser'
  | 'storage'
  | 'ai'
  | 'pagespeed'
  | 'auth'
  | 'billing'
  | 'email'
  | 'productWatch'

export type ReadinessSubsystem = {
  ok: boolean
  detail?: string
}

export type LaunchReadiness = {
  ok: boolean
  checkedAt: string
  missing: ReadinessSubsystemName[]
  subsystems: Record<ReadinessSubsystemName, ReadinessSubsystem>
}

type ReadinessDependencies = Record<ReadinessSubsystemName, () => Promise<ReadinessSubsystem>>

const configured = (ok: boolean, detail: string): Promise<ReadinessSubsystem> =>
  Promise.resolve({ ok, ...(!ok ? { detail } : {}) })

function productionDependencies(): ReadinessDependencies {
  return {
    database: async () => {
      await prisma.$queryRaw`SELECT 1`
      return { ok: true }
    },
    redis: async () => {
      const redis = createQueueRedis()
      try {
        await redis.connect()
        await redis.ping()
        return { ok: true }
      } finally {
        redis.disconnect()
      }
    },
    worker: async () => {
      const heartbeat = await readWorkerHeartbeat()
      return heartbeat.alive
        ? { ok: true }
        : { ok: false, detail: 'No current worker heartbeat' }
    },
    browser: async () => {
      const browser = await getAuditBrowser()
      const context = await browser.newContext()
      try {
        const page = await context.newPage()
        try {
          await page.setContent('<!doctype html><html><body>ready</body></html>')
          await page.screenshot({ type: 'png' })
          return { ok: true }
        } finally {
          await page.close()
        }
      } finally {
        await context.close()
      }
    },
    storage: async () => {
      if (process.env.NODE_ENV !== 'production') return { ok: true }
      if (!isProdStorageConfigured()) return { ok: false, detail: 'R2 configuration is incomplete' }
      await checkR2Connection()
      return { ok: true }
    },
    ai: () => configured(isAiProviderConfigured(), 'No AI provider is configured'),
    pagespeed: () => configured(Boolean(process.env.PAGESPEED_API_KEY), 'PAGESPEED_API_KEY is missing'),
    auth: async () => {
      try {
        validateAuthEnv()
        return { ok: true }
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : String(error) }
      }
    },
    billing: () => configured(isBillingFullyConfigured(), 'Stripe billing is incomplete'),
    email: () => configured(
      Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      'Email delivery is incomplete'
    ),
    productWatch: async () => {
      const readiness = productWatchReadiness()
      return readiness.available
        ? { ok: true }
        : { ok: false, detail: readiness.error ?? 'Product Watch is unavailable' }
    },
  }
}

async function safeCheck(check: () => Promise<ReadinessSubsystem>): Promise<ReadinessSubsystem> {
  try {
    return await check()
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}

let cached: { expiresAt: number; value: LaunchReadiness } | null = null
const CACHE_MS = 15_000

export async function readLaunchReadiness(
  dependencies?: ReadinessDependencies
): Promise<LaunchReadiness> {
  const useCache = dependencies == null
  if (useCache && cached && cached.expiresAt > Date.now()) return cached.value

  const activeDependencies = dependencies ?? productionDependencies()
  const names = Object.keys(activeDependencies) as ReadinessSubsystemName[]
  const values = await Promise.all(names.map((name) => safeCheck(activeDependencies[name])))
  const subsystems = Object.fromEntries(names.map((name, index) => [name, values[index]])) as LaunchReadiness['subsystems']
  const missing = names.filter((name) => !subsystems[name].ok)
  const value = { ok: missing.length === 0, checkedAt: new Date().toISOString(), missing, subsystems }
  if (useCache) cached = { expiresAt: Date.now() + CACHE_MS, value }
  return value
}
