import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { getGatedAuditForRequest } from '@/lib/audit/fetch-audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getGatedAuditForRequest(id)

    if (result.kind === 'not_found') {
      return apiError('Audit not found', 404)
    }

    if (result.kind === 'forbidden') {
      return apiError('You do not have access to this audit', 403)
    }

    return NextResponse.json(result.audit)
  } catch (err) {
    return handleRouteError(err)
  }
}
