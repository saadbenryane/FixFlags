import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string; filename: string }> }
) {
  try {
    const { runId, filename } = await context.params
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(runId) || !/^[a-zA-Z0-9_-]+\.(png|gif|webm)$/.test(filename)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const session = await resolveSessionUser()
    const outcomeRun = outcomeRequestIdForArtifactNamespace(runId)
    const pathRun = pathIdForArtifactNamespace(runId)
    let allowed = false
    if (outcomeRun && session?.user.id) {
      // The namespace is produced from this durable tenant-owned request, not
      // the target hostname or knowledge of an opaque capture URL.
      allowed = Boolean(await prisma.runRequest.findFirst({
        where: { id: outcomeRun, project: { userId: session.user.id } },
        select: { id: true },
      }))
    } else if (pathRun) {
      const shopDomain = shopDomainFromRequest(request)
      const path = await prisma.revenuePath.findFirst({
        where: { id: pathRun, shop: { uninstalledAt: null } },
        select: { shop: { select: { shopDomain: true, project: { select: { userId: true } } } } },
      })
      allowed = Boolean(path && (
        (session?.user.id && path.shop.project?.userId === session.user.id) ||
        (shopDomain && path.shop.shopDomain === shopDomain)
      ))
    }
    if (!allowed) return NextResponse.json({ error: 'You do not have access to this evidence' }, { status: 403 })
    const bytes = await readIntegrityArtifact(runId, filename)
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
