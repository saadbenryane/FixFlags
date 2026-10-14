import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import {
  readGithubConnectState,
} from '@/lib/integrations/github'
import { githubResultDestination } from '@/lib/integrations/github-continuation'
import { saveGithubAuthorization } from '@/lib/integrations/github-connection'
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
  const verifiedState = state ? readGithubConnectState(state, session.user.id) : null
  const destination = verifiedState?.destination ?? '/settings/integrations'
  const result = (key: 'error' | 'connected', value: string) => NextResponse.redirect(new URL(githubResultDestination(destination, key, value), SITE_URL))

  if (!verifiedState) return result('error', 'invalid_state')
  if (oauthError) return result('error', 'denied')
  if (!code) return result('error', 'invalid_state')

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || !canScanRepositories(user)) {
    return result('error', 'access_unavailable')
  }

  try {
    await saveGithubAuthorization(user.id, code)

    return result('connected', '1')
  } catch (err) {
    logger.error('GitHub connect callback failed', err instanceof Error ? err : new Error(String(err)))
    return result('error', 'connect_failed')
  }
}
