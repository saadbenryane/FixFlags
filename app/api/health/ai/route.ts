import { NextRequest, NextResponse } from 'next/server'
import {
  getAiProviderHealth,
  validateAiProviderCredentials,
} from '@/lib/audit/health/ai-providers'
import { QUALITY_TRIAGE_SCHEMA_OPENAI } from '@/lib/audit/judge-triage-schema'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { adminPrivateHeaders, requireAdminOrigin } from '@/lib/admin/http'
import { handleRouteError } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

/**
 * Deeper AI readiness probe for deploy smoke tests.
 * Live credential validation requires the existing administrator session and
 * trusted origin because it makes a paid provider request.
 */
export async function GET(request: NextRequest) {
  const validate = request.nextUrl.searchParams.get('validate') === '1'
  if (validate) {
    try {
      requireAdminOrigin(request)
      const actor = await requireAdmin()
      if (isAdminResponse(actor)) return actor
    } catch (error) {
      return handleRouteError(error, 'Could not authorize credential validation.')
    }
  }
  try {
    const ai = getAiProviderHealth()
    const schemaValid = Boolean(QUALITY_TRIAGE_SCHEMA_OPENAI)
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
    }, { headers: adminPrivateHeaders })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 503 }
    )
  }
}
