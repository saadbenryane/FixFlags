import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import {
  buildGscAuthorizeUrl,
  isGoogleSearchConsoleConfigured,
  signGscConnectState,
} from '@/lib/integrations/google-search-console'
import { SITE_URL } from '@/lib/marketing/copy'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.redirect(
        new URL('/sign-in?next=/settings', SITE_URL)
      )
    }

    const clientId = requestClientId(await headers())
    await enforceRateLimit({
      scope: 'gsc-connect',
      identifier: `${session.user.id}:${clientId}`,
      limit: 5,
      windowSeconds: 60,
    })

    if (!isGoogleSearchConsoleConfigured()) {
      return NextResponse.redirect(
        new URL('/settings?error=gsc_not_configured', SITE_URL)
      )
    }

    const state = signGscConnectState(session.user.id)
    return NextResponse.redirect(buildGscAuthorizeUrl(state))
  } catch {
    return NextResponse.redirect(
      new URL('/settings?error=gsc_connect_failed', SITE_URL)
    )
  }
}
