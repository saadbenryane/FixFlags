import { NextRequest, NextResponse } from 'next/server'
import {
  getAiProviderHealth,
  validateAiProviderCredentials,
} from '@/lib/audit/health/ai-providers'
import { QUALITY_TRIAGE_SCHEMA_OPENAI } from '@/lib/audit/judge-triage-schema'

export const dynamic = 'force-dynamic'

/**
 * Deeper AI readiness probe for deploy smoke tests.
 * Pass ?validate=1 for a minimal live credential check (not used by Railway healthcheck).
 */
export async function GET(request: NextRequest) {
  const ai = getAiProviderHealth()
  const schemaValid = Boolean(QUALITY_TRIAGE_SCHEMA_OPENAI)
  const validate = request.nextUrl.searchParams.get('validate') === '1'
  const validation = validate ? await validateAiProviderCredentials() : undefined
  const credentialsOk = validation ? validation.ok : true

  return NextResponse.json({
    ok: ai.configured && schemaValid && credentialsOk,
    ai,
    triageSchemaLoaded: schemaValid,
    ...(validation ? { validation } : {}),
  })
}
