import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { id: true, url: true, userId: true, status: true },
    })
    if (!audit) return apiError('Audit not found', 404)
    if (audit.status !== 'FAILED') {
      return apiError('Only failed audits can be retried', 409, { code: 'NOT_FAILED' })
    }

    const result = await createAndEnqueueAudit({
      url: audit.url,
      userId: audit.userId,
      skipUsageCount: true,
    })

    return NextResponse.json({ auditId: result.auditId, status: result.status })
  } catch (error) {
    return handleRouteError(error, 'Failed to retry audit')
  }
}
