import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isProdStorageConfigured, isAiProviderConfigured } from '@/lib/env'
import { getJudgeProviderChain } from '@/lib/audit/judge-config'

export const dynamic = 'force-dynamic'

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
      storageConfigured,
      aiConfigured: ai.configured,
      aiProviderChain: ai.providerChain,
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
