import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import { listGithubRepos } from '@/lib/integrations/github'
import { decryptSecret } from '@/lib/security/crypto'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !canScanRepositories(user)) {
      return apiError('Repository scanning requires the Agency plan', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      })
    }

    const connection = await prisma.githubConnection.findUnique({ where: { userId: user.id } })
    if (!connection || connection.revokedAt) {
      return apiError('GitHub is not connected', 409, { code: 'NOT_CONNECTED' })
    }

    const accessToken = decryptSecret(connection.encryptedAccessToken)
    const repos = await listGithubRepos(accessToken)
    return NextResponse.json({
      repos: repos.map((r) => ({ fullName: r.full_name, private: r.private })),
      selectedRepos: connection.selectedRepos,
      githubLogin: connection.githubLogin,
    })
  } catch (err) {
    return handleRouteError(err, 'Failed to list GitHub repositories')
  }
}
