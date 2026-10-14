import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import {
  buildGithubAuthorizeUrl,
  isGithubRepoAccessConfigured,
  signGithubConnectState,
} from '@/lib/integrations/github'
import { SITE_URL } from '@/lib/marketing/copy'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { githubSettingsDestination, githubResultDestination } from '@/lib/integrations/github-continuation'

export async function GET(request: NextRequest) {
  const destination = githubSettingsDestination(request.nextUrl.searchParams.get('next'))
  const result = (error: string) => NextResponse.redirect(new URL(githubResultDestination(destination, 'error', error), SITE_URL))
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(destination)}`, SITE_URL))
    }

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'github-connect', identifier: `${session.user.id}:${clientId}`, limit: 5, windowSeconds: 60 })

    if (!isGithubRepoAccessConfigured()) {
      return result('not_configured')
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !canScanRepositories(user)) {
      return result('access_unavailable')
    }

    const state = signGithubConnectState(session.user.id, destination)
    return NextResponse.redirect(buildGithubAuthorizeUrl(state))
  } catch {
    return result('connect_failed')
  }
}
