import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canManageAudit } from '@/lib/audit/access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import { retryAudit } from '@/lib/audit/retry-audit'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { headers } from 'next/headers'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await resolveSessionUser()

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'audit-retry', identifier: `${session?.user?.id ?? clientId}:${clientId}`, limit: 10, windowSeconds: 60 })
    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { userId: true, isPublic: true, status: true, triageAt: true, failureCode: true },
    })
    if (!audit) return apiError('Report not found', 404)
    if (!canManageAudit(audit, session?.user)) {
      return apiError('You do not have access to this report', 403)
    }

    const triageDegraded =
      audit.status === 'COMPLETED' && !audit.triageAt && Boolean(audit.failureCode)
    if (audit.status !== 'FAILED' && !triageDegraded) {
      return apiError('Only failed or AI-degraded reports can be retried', 400)
    }

    const result = await retryAudit(id)
    return NextResponse.json(result)
  } catch (err) {
    return handleRouteError(err)
  }
}
