import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canAccessAudit } from '@/lib/audit/access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import { retryAudit } from '@/lib/audit/retry-audit'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await resolveSessionUser()
    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { userId: true, isPublic: true, status: true },
    })
    if (!audit) return apiError('Audit not found', 404)
    if (!canAccessAudit(audit, session?.user)) {
      return apiError('You do not have access to this audit', 403)
    }
    if (audit.status !== 'FAILED') {
      return apiError('Only failed audits can be retried', 400)
    }

    const result = await retryAudit(id)
    return Response.json(result)
  } catch (err) {
    return handleRouteError(err)
  }
}
