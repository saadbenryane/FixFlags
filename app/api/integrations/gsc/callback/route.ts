import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  exchangeCodeForGscTokens,
  listGscSites,
  verifyGscConnectState,
} from '@/lib/integrations/google-search-console'
import { encryptSecret } from '@/lib/security/crypto'
import { SITE_URL } from '@/lib/marketing/copy'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.redirect(
      new URL('/sign-in?next=/settings', SITE_URL)
    )
  }

  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(
      new URL('/settings?error=gsc_denied', SITE_URL)
    )
  }
  if (!code || !state || !verifyGscConnectState(state, session.user.id)) {
    return NextResponse.redirect(
      new URL('/settings?error=gsc_invalid_state', SITE_URL)
    )
  }

  try {
    const tokens = await exchangeCodeForGscTokens(code)
    const sites = await listGscSites(tokens.accessToken)

    const siteUrl =
      sites.find((s) => s.permissionLevel === 'siteOwner')?.siteUrl ??
      sites[0]?.siteUrl

    if (!siteUrl) {
      return NextResponse.redirect(
        new URL('/settings?error=gsc_no_sites', SITE_URL)
      )
    }

    await prisma.gscConnection.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        accessToken: encryptSecret(tokens.accessToken),
        refreshToken: encryptSecret(tokens.refreshToken),
        tokenExpiry: new Date(Date.now() + tokens.expiresInSeconds * 1000),
        siteUrl,
      },
      update: {
        accessToken: encryptSecret(tokens.accessToken),
        refreshToken: encryptSecret(tokens.refreshToken),
        tokenExpiry: new Date(Date.now() + tokens.expiresInSeconds * 1000),
        siteUrl,
      },
    })

    return NextResponse.redirect(
      new URL('/settings?gsc_connected=1', SITE_URL)
    )
  } catch (err) {
    logger.error(
      'GSC connect callback failed',
      err instanceof Error ? err : new Error(String(err))
    )
    return NextResponse.redirect(
      new URL('/settings?error=gsc_connect_failed', SITE_URL)
    )
  }
}
