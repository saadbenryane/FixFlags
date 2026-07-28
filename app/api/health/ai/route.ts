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
  try {
    const ai = getAiProviderHealth()
    const schemaValid = Boolean(QUALITY_TRIAGE_SCHEMA_OPENAI)
    const validate = request.nextUrl.searchParams.get('validate') === '1'
    const validation = validate ? await validateAiProviderCredentials() : undefined
    const credentialsOk = validation ? validation.ok : true
    const credentialValidation = validate
      ? validation?.ok
        ? 'valid'
        : 'invalid'
      : 'not_checked'

    return NextResponse.json({
      ok: ai.configured && schemaValid && credentialsOk,
      ai,
      triageSchemaLoaded: schemaValid,
      credentialValidation,
      ...(validation ? { validatedAt: new Date().toISOString() } : {}),
      ...(validation ? { validation } : {}),
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 503 }
    )
  }
}
