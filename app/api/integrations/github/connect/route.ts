import { NextResponse } from 'next/server'
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

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.redirect(new URL('/sign-in?next=/settings/integrations', SITE_URL))
    }

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'github-connect', identifier: `${session.user.id}:${clientId}`, limit: 5, windowSeconds: 60 })

    if (!isGithubRepoAccessConfigured()) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=not_configured', SITE_URL)
      )
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !canScanRepositories(user)) {
      return NextResponse.redirect(new URL('/settings/integrations?error=upgrade_required', SITE_URL))
    }

    const state = signGithubConnectState(session.user.id)
    return NextResponse.redirect(buildGithubAuthorizeUrl(state))
  } catch {
    return NextResponse.redirect(new URL('/settings/integrations?error=connect_failed', SITE_URL))
  }
}
