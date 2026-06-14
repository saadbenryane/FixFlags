import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canManageAudit } from '@/lib/audit/access'
import { canSharePublicly } from '@/lib/auth/permissions'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { userId: true, isPublic: true },
    })
    if (!audit) return apiError('Audit not found', 404)

    if (!canManageAudit(audit, session?.user)) {
      return apiError('Sign in to manage sharing for this audit', 401)
    }

    const enablingPublic = !audit.isPublic
    if (enablingPublic && session?.user) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } })
      if (!user || !canSharePublicly(user)) {
        return apiError('Upgrade to Agency to share client report links', 402, {
          code: 'UPGRADE_REQUIRED',
          action: 'upgrade',
        })
      }
    }

    const updated = await prisma.audit.update({
      where: { id },
      data: { isPublic: !audit.isPublic },
      select: { isPublic: true },
    })

    return NextResponse.json(updated)
  } catch (err) {
    return handleRouteError(err)
  }
}
