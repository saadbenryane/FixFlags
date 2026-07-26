import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import { createAndEnqueueFixPr, RepoFixPrRequestError } from '@/lib/repo-scan/create-fix-pr'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !canScanRepositories(user)) {
      return apiError('Fix PRs require the Studio plan', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      })
    }

    const { id: repoScanId, findingId } = await params

    const scan = await prisma.repoScan.findUnique({
      where: { id: repoScanId },
      select: { id: true, userId: true, repoFullName: true },
    })
    if (!scan || scan.userId !== session.user.id) {
      return apiError('Repo scan not found', 404, { code: 'NOT_FOUND' })
    }

    await enforceRateLimit({
      scope: 'repo-fix-pr',
      identifier: `${user.id}:${scan.repoFullName}`,
      limit: 10,
      windowSeconds: 3600,
    })

    const { repoFixPrId } = await createAndEnqueueFixPr(user.id, repoScanId, findingId)
    return NextResponse.json({ repoFixPrId, status: 'DRAFT' })
  } catch (err) {
    if (err instanceof RepoFixPrRequestError) {
      const status =
        err.code === 'UPGRADE_REQUIRED' ? 402 : err.code === 'ALREADY_EXISTS' ? 409 : 400
      return apiError(err.message, status, { code: err.code })
    }
    return handleRouteError(err, 'Failed to start fix PR')
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const { id: repoScanId, findingId } = await params

    const fixPr = await prisma.repoFixPr.findUnique({
      where: { findingId },
      select: {
        id: true,
        repoScanId: true,
        userId: true,
        status: true,
        prNumber: true,
        prUrl: true,
        patchApplied: true,
        errorMsg: true,
      },
    })
    if (!fixPr || fixPr.repoScanId !== repoScanId || fixPr.userId !== session.user.id) {
      return apiError('No fix PR found for this finding', 404, { code: 'NOT_FOUND' })
    }

    return NextResponse.json({ fixPr })
  } catch (err) {
    return handleRouteError(err, 'Failed to load fix PR status')
  }
}
