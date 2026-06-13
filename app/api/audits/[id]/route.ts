import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canAccessAudit, gateAuditResponse, isPaidUser } from '@/lib/audit/access'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

    const audit = await prisma.audit.findUnique({
      where: { id },
      include: {
        areas: {
          include: {
            findings: {
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
        screenshots: true,
      },
    })

    if (!audit) {
      return apiError('Audit not found', 404)
    }

    if (!canAccessAudit(audit, session?.user)) {
      return apiError('You do not have access to this audit', 403)
    }

    let isPaid = false
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true },
      })
      isPaid = isPaidUser(user)
    }

    const gated = gateAuditResponse(audit, isPaid)
    return NextResponse.json(gated)
  } catch (err) {
    return handleRouteError(err)
  }
}
