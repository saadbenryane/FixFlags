import { NextResponse } from 'next/server'
import { getAiProviderHealth } from '@/lib/audit/health/ai-providers'
import { QUALITY_TRIAGE_SCHEMA_OPENAI } from '@/lib/audit/judge-triage-schema'

export const dynamic = 'force-dynamic'

/**
 * Deeper AI readiness probe for deploy smoke tests. Does not call LLM APIs.
 * Always returns 200 so it never blocks Railway healthchecks.
 */
export async function GET() {
  const ai = getAiProviderHealth()
  const schemaValid = Boolean(QUALITY_TRIAGE_SCHEMA_OPENAI)

  return NextResponse.json({
    ok: ai.configured && schemaValid,
    ai,
    triageSchemaLoaded: schemaValid,
  })
}
