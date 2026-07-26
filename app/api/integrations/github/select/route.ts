import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

const MAX_SELECTED_REPOS = 20

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'github-select', identifier: `${session.user.id}:${clientId}`, limit: 10, windowSeconds: 60 })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !canScanRepositories(user)) {
      return apiError('Repository scanning requires the Studio plan', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      })
    }

    const connection = await prisma.githubConnection.findUnique({ where: { userId: user.id } })
    if (!connection || connection.revokedAt) {
      return apiError('GitHub is not connected', 409, { code: 'NOT_CONNECTED' })
    }

    const body = await req.json().catch(() => ({}))
    const repos = Array.isArray(body.repos) ? body.repos.filter((r: unknown) => typeof r === 'string') : null
    if (!repos) return apiError('repos must be an array of full repo names', 400, { code: 'INVALID_REQUEST' })
    if (repos.length > MAX_SELECTED_REPOS) {
      return apiError(`You can allow-list up to ${MAX_SELECTED_REPOS} repositories`, 400, {
        code: 'INVALID_REQUEST',
      })
    }

    await prisma.githubConnection.update({
      where: { userId: user.id },
      data: { selectedRepos: repos },
    })

    return NextResponse.json({ selectedRepos: repos })
  } catch (err) {
    return handleRouteError(err, 'Failed to update selected repositories')
  }
}
