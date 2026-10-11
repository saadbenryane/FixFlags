import { NextResponse } from 'next/server'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function GET(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const cursor = new URL(request.url).searchParams.get('cursor') ?? undefined
    if (cursor && !/^[a-zA-Z0-9_-]{1,1024}$/.test(cursor)) return apiError('Invalid check history cursor', 400)
    const site = access.decision.site
    const latest = site.projectId ? await prisma.audit.findFirst({
      where: { projectId: site.projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true },
    }) : null
    const page = await loadSiteCheckResultPage(site, latest?.id ?? site.primaryAuditId, cursor)
    return NextResponse.json(page, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid check history cursor') return apiError(error.message, 400)
    return handleRouteError(error, 'Could not load check results')
  }
}
