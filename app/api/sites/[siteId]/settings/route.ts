import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { prisma } from '@/lib/db'
import { requireSiteAccess } from '@/lib/sites/request-access'

const schema = z.object({
  notificationLevel: z.enum(['FLAGS', 'CRITICAL_ONLY', 'OFF']).optional(),
  notifyOnRecovery: z.boolean().optional(),
  accountChecksEnabled: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0)

export async function PATCH(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) return apiError('Sign in to change Site settings.', 401)
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const projectId = access.decision.site.projectId
    if (access.decision.role !== 'owner' || !projectId) return apiError('Claim this Site first.', 403)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Choose valid notification settings.', 400)
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.project.updateMany({
        where: { id: projectId, userId: session.user.id, deletedAt: null },
        data: { ...parsed.data, ...(parsed.data.accountChecksEnabled !== undefined ? { accountCheckRevision: { increment: 1 } } : {}) },
      })
      if (result.count === 1 && parsed.data.accountChecksEnabled === false) await tx.siteAccountMessage.deleteMany({ where: { account: { projectId } } })
      if (result.count === 1 && parsed.data.accountChecksEnabled === true) {
        // Re-enabling after explicit cleanup is the owner's request to provision again.
        await tx.siteTestAccount.deleteMany({ where: { projectId, state: 'DELETED', purpose: 'retained' } })
      }
      return result
    })
    if (updated.count !== 1) return apiError('Site not found.', 404)
    return NextResponse.json({ ok: true, ...parsed.data })
  } catch (error) {
    return handleRouteError(error)
  }
}
