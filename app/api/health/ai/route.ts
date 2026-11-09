import { NextRequest, NextResponse } from 'next/server'
import {
  getAiProviderHealth,
  validateAiProviderCredentials,
} from '@/lib/audit/health/ai-providers'
import { QUALITY_TRIAGE_SCHEMA_OPENAI } from '@/lib/audit/judge-triage-schema'
import { requireAdmin, isAdminResponse, type AdminActor } from '@/lib/auth/require-admin'
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
  let actor: AdminActor | undefined
  if (validate) {
    try {
      requireAdminOrigin(request)
      const authorized = await requireAdmin()
      if (isAdminResponse(authorized)) return authorized
      actor = authorized
    } catch (error) {
      return handleRouteError(error, 'Could not authorize credential validation.')
    }
  }
  try {
    const ai = getAiProviderHealth()
    const schemaValid = Boolean(QUALITY_TRIAGE_SCHEMA_OPENAI)
    const validation = actor ? await validateAiProviderCredentials(actor) : undefined
    const credentialsOk = validation ? validation.ok : true
    const credentialValidation = validate
      ? !validation ? 'not_configured' : validation.ok ? 'valid'
        : validation.failure === 'authentication_rejected' ? 'invalid' : 'unavailable'
      : 'not_checked'

    return NextResponse.json({
      ok: ai.configured && ai.budget.configured && schemaValid && credentialsOk,
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
