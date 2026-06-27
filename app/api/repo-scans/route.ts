import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import { createAndEnqueueRepoScan, RepoScanRequestError } from '@/lib/repo-scan/create-repo-scan'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !canScanRepositories(user)) {
      return apiError('Repository scanning requires the Max plan', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      })
    }

    const body = await req.json().catch(() => ({}))
    const repoFullName = typeof body.repoFullName === 'string' ? body.repoFullName : null
    if (!repoFullName) return apiError('repoFullName is required', 400, { code: 'INVALID_REQUEST' })

    const { repoScanId } = await createAndEnqueueRepoScan(user.id, repoFullName)
    return NextResponse.json({ repoScanId, status: 'QUEUED' })
  } catch (err) {
    if (err instanceof RepoScanRequestError) {
      const status = err.code === 'UPGRADE_REQUIRED' ? 402 : 409
      return apiError(err.message, status, { code: err.code })
    }
    return handleRouteError(err, 'Failed to start repo scan')
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const scans = await prisma.repoScan.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        repoFullName: true,
        commitSha: true,
        status: true,
        errorMsg: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        _count: { select: { findings: true } },
      },
    })

    return NextResponse.json({ scans })
  } catch (err) {
    return handleRouteError(err, 'Failed to list repo scans')
  }
}
