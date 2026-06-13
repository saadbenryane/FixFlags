import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { checkUserAuditAllowed } from '@/lib/audit/usage'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentId } = await params

    const parent = await prisma.audit.findUnique({ where: { id: parentId } })
    if (!parent) {
      return apiError('Audit not found', 404)
    }

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

    if (!session?.user) {
      return apiError('Sign in to re-check audits', 401)
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || user.plan === 'FREE') {
      return apiError('Upgrade to Builder to use re-check', 402)
    }

    const limitCheck = await checkUserAuditAllowed(user)
    if (!limitCheck.allowed) {
      return apiError(limitCheck.error!, 402)
    }

    const { auditId, status } = await createAndEnqueueAudit({
      url: parent.url,
      userId: session.user.id,
      parentId,
    })

    return NextResponse.json({ auditId, status }, { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
}
