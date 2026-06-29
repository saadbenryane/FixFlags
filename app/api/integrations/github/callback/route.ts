import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import {
  exchangeCodeForGithubToken,
  fetchGithubUser,
  verifyGithubConnectState,
} from '@/lib/integrations/github'
import { encryptSecret } from '@/lib/security/crypto'
import { SITE_URL } from '@/lib/marketing/copy'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.redirect(new URL('/sign-in?next=/settings/integrations', SITE_URL))
  }

  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=denied', SITE_URL)
    )
  }
  if (!code || !state || !verifyGithubConnectState(state, session.user.id)) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=invalid_state', SITE_URL)
    )
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || !canScanRepositories(user)) {
    return NextResponse.redirect(new URL('/settings/integrations?error=upgrade_required', SITE_URL))
  }

  try {
    const { accessToken, scope } = await exchangeCodeForGithubToken(code)
    const githubUser = await fetchGithubUser(accessToken)

    await prisma.githubConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        githubUserId: String(githubUser.id),
        githubLogin: githubUser.login,
        encryptedAccessToken: encryptSecret(accessToken),
        scope,
        selectedRepos: [],
      },
      update: {
        githubUserId: String(githubUser.id),
        githubLogin: githubUser.login,
        encryptedAccessToken: encryptSecret(accessToken),
        scope,
        revokedAt: null,
        connectedAt: new Date(),
      },
    })

    return NextResponse.redirect(new URL('/settings/integrations?connected=1', SITE_URL))
  } catch (err) {
    logger.error('GitHub connect callback failed', err instanceof Error ? err : new Error(String(err)))
    return NextResponse.redirect(new URL('/settings/integrations?error=connect_failed', SITE_URL))
  }
}
