import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { requireAdmin } from '@/lib/auth/require-admin'
import { retryAudit } from '@/lib/audit/retry-audit'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!audit) return apiError('Audit not found', 404)
    if (audit.status !== 'FAILED') {
      return apiError('Only failed audits can be retried', 400)
    }

    const result = await retryAudit(id)
    return Response.json(result)
  } catch (err) {
    return handleRouteError(err)
  }
}
