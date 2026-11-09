import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { readIntegrityArtifact } from '@/lib/integrity/storage'
import { pathIdForArtifactNamespace, outcomeRequestIdForArtifactNamespace } from '@/lib/integrity/artifact-namespace'
import { prisma } from '@/lib/db'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import { shopDomainFromRequest } from '@/lib/shopify/session'
import { handleRouteError } from '@/lib/api/errors'

export const runtime = 'nodejs'

function contentTypeFor(filename: string): string {
  if (filename.endsWith('.webm')) return 'video/webm'
  if (filename.endsWith('.gif')) return 'image/gif'
  if (filename.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

type ActiveSite = () => Prisma.ProjectWhereInput

async function admitOutcomeArtifact(id: string, ownedSite: ActiveSite) {
  const run = await prisma.runRequest.findFirst({
    where: { id, project: ownedSite() },
    select: { projectId: true, auditId: true, audit: { select: { projectId: true } } },
  })
  if (!run || run.audit && run.audit.projectId !== run.projectId) return null
  return async () => Boolean(await prisma.runRequest.findFirst({
    where: { id, projectId: run.projectId, auditId: run.auditId, project: ownedSite(),
      ...(run.auditId ? { audit: { projectId: run.projectId } } : {}) },
    select: { id: true },
  }))
}

async function admitShopifyArtifact(request: NextRequest, id: string, ownedSite: ActiveSite | null) {
  const shopDomain = shopDomainFromRequest(request)
  if (!shopDomain && !ownedSite) return null
  const shop = await prisma.shopifyShop.findFirst({
    where: { paths: { some: { id } }, uninstalledAt: null, OR: [
      ...(shopDomain ? [{ shopDomain }] : []),
      ...(ownedSite ? [{ project: ownedSite() }] : []),
    ] },
    select: { id: true, shopDomain: true, projectId: true, authorizationVersion: true },
  })
  if (!shop) return null
  const viaShop = shopDomain !== null && shopDomain === shop.shopDomain
  if (!viaShop && (!ownedSite || !shop.projectId)) return null
  return async () => {
    if (viaShop && shopDomainFromRequest(request) !== shopDomain) return false
    const project = ownedSite?.()
    if (!viaShop && !project) return false
    return Boolean(await prisma.shopifyShop.findFirst({
      where: { id: shop.id, paths: { some: { id } }, uninstalledAt: null, authorizationVersion: shop.authorizationVersion,
        ...(viaShop ? { shopDomain: shop.shopDomain } : { projectId: shop.projectId, project }) },
      select: { id: true },
    }))
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string; filename: string }> }
) {
  try {
    const { runId, filename } = await context.params
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(runId) || !/^[a-zA-Z0-9_-]+\.(png|gif|webm)$/.test(filename)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const outcomeRun = outcomeRequestIdForArtifactNamespace(runId)
    const pathRun = pathIdForArtifactNamespace(runId)
    const viewer = outcomeRun || pathRun ? await resolveSessionUser() : null
    const ownedSite: ActiveSite | null = viewer?.session?.id && viewer.user.id ? () => ({
      userId: viewer.user.id, deletedAt: null,
      user: { lifecycleStatus: 'ACTIVE', sessions: { some: { id: viewer.session.id, expiresAt: { gt: new Date() } } } },
    }) : null
    const recheck = outcomeRun && ownedSite ? await admitOutcomeArtifact(outcomeRun, ownedSite)
      : pathRun ? await admitShopifyArtifact(request, pathRun, ownedSite) : null
    const denied = () => NextResponse.json({ error: 'You do not have access to this evidence' }, { status: 403 })
    if (!recheck) return denied()
    const bytes = await readIntegrityArtifact(runId, filename, { signal: request.signal })
    // Storage can be slow. The original grant must still authorize the response.
    if (!await recheck()) return denied()
    if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentTypeFor(filename),
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie, Authorization',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) { return handleRouteError(error) }
}
