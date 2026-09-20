import { NextResponse } from 'next/server'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)

    const home = await loadSiteHome(access.decision.site.siteId)
    if (!home) return apiError('Site not found', 404)
    return NextResponse.json(home)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const projectId = access.decision.site.projectId
    if (access.decision.role !== 'owner' || !projectId) return apiError('Claim this Site first.', 403)
    await prisma.$transaction([
      prisma.shopifyShop.updateMany({
        where: { projectId },
        data: { projectId: null, linkedAt: null },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: {
          deletedAt: new Date(),
          isManaged: false,
          watchInterval: null,
          watchNextRunAt: null,
          watchLeaseUntil: null,
          watchLastError: null,
          watchConsecutiveFailures: 0,
        },
      }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not remove Site')
  }
}
