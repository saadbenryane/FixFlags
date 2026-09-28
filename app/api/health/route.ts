import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isProdStorageConfigured, isAiProviderConfigured } from '@/lib/env'
import { isBillingFullyConfigured } from '@/lib/billing/config'
import { getOpenAIProviderKey } from '@/lib/audit/llm-keys'
import { getJudgeProviderChain, getConfiguredJudgeProviderChain } from '@/lib/audit/judge-config'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { productWatchReadiness } from '@/lib/audit/project-watch'
import { getRateLimitRedisHealth } from '@/lib/security/rate-limit'
import { resolveCommitSha } from '@/lib/health/commit-sha'
import { readMigrationReadiness } from '@/lib/health/readiness'

export const dynamic = 'force-dynamic'

/**
 * Liveness + readiness probe (the platform healthcheck path).
 *
 * Returns 200 whenever the database is reachable so a deploy is never frozen by
 * storage, AI, or migration readiness, which are reported as informational flags
 * rather than gating the healthcheck. The authoritative migration gate is
 * /api/health/ready.
 */
export async function GET() {
  const storageConfigured =
    process.env.NODE_ENV === 'production' ? isProdStorageConfigured() : true
  const billingConfigured = isBillingFullyConfigured()
  const productWatch = productWatchReadiness()
  const rateLimit = getRateLimitRedisHealth()
  const ai = {
    configured: isAiProviderConfigured(),
    providerChain: getJudgeProviderChain(),
    configuredProviders: getConfiguredJudgeProviderChain(),
    openai: Boolean(getOpenAIProviderKey()),
  }
  // A probe failure must not take liveness down, so an unreadable ledger is
  // reported as degraded rather than thrown.
  const migrations = await readMigrationReadiness().catch((error) => ({
    ok: false,
    detail: error instanceof Error ? error.message : String(error),
  }))
  const degraded: string[] = []
  if (!storageConfigured) degraded.push('storage')
  if (!ai.configured) degraded.push('ai')
  if (!billingConfigured) degraded.push('billing')
  if (!productWatch.available) degraded.push('product_watch')
  if (rateLimit.redisDown) degraded.push('rate_limit_redis')
  if (!migrations.ok) degraded.push('migrations')

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      healthy: true,
      ok: true,
      status: 'ok',
      database: 'ok',
      commit: resolveCommitSha(),
      pipelineVersion: PIPELINE_VERSION,
      storageConfigured,
      billingConfigured,
      aiConfigured: ai.configured,
      aiProviderChain: ai.providerChain,
      aiConfiguredProviders: ai.configuredProviders,
      productWatch,
      emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      workerConfigured: Boolean(process.env.REDIS_URL),
      rateLimit,
      migrations,
      ...(degraded.length > 0 ? { degraded } : {}),
    })
  } catch {
    return NextResponse.json(
      {
        healthy: false,
        ok: false,
        status: 'error',
        database: 'error',
        commit: resolveCommitSha(),
        storageConfigured,
        billingConfigured,
        aiConfigured: ai.configured,
        aiProviderChain: ai.providerChain,
        productWatch,
        emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
        workerConfigured: Boolean(process.env.REDIS_URL),
        rateLimit,
        migrations,
        ...(degraded.length > 0 ? { degraded } : {}),
      },
      { status: 503 }
    )
  }
}
