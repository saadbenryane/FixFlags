import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isProdStorageConfigured, isAiProviderConfigured } from '@/lib/env'
import { getJudgeProviderChain, getConfiguredJudgeProviderChain } from '@/lib/audit/judge-config'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'

export const dynamic = 'force-dynamic'

// Deployed build markers, so a deploy is observable from the outside (the
// platform sets RAILWAY_GIT_COMMIT_SHA at build time).
const COMMIT_SHA =
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.GIT_COMMIT_SHA?.slice(0, 7) ??
  null

/**
 * Liveness + readiness probe (the platform healthcheck path).
 *
 * Returns 200 whenever the database is reachable so a deploy is never frozen by
 * a degradable misconfiguration. Storage and AI readiness are reported as
 * informational flags rather than gating the healthcheck.
 */
export async function GET() {
  const storageConfigured =
    process.env.NODE_ENV === 'production' ? isProdStorageConfigured() : true
  const ai = {
    configured: isAiProviderConfigured(),
    providerChain: getJudgeProviderChain(),
    configuredProviders: getConfiguredJudgeProviderChain(),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  }
  const degraded: string[] = []
  if (!storageConfigured) degraded.push('storage')
  if (!ai.configured) degraded.push('ai')

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ok',
      database: 'ok',
      commit: COMMIT_SHA,
      pipelineVersion: PIPELINE_VERSION,
      storageConfigured,
      aiConfigured: ai.configured,
      aiProviderChain: ai.providerChain,
      aiConfiguredProviders: ai.configuredProviders,
      ...(degraded.length > 0 ? { degraded } : {}),
    })
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        database: 'error',
        storageConfigured,
        aiConfigured: ai.configured,
        aiProviderChain: ai.providerChain,
      },
      { status: 503 }
    )
  }
}
