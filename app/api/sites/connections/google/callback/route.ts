import { integrationRelease } from '@/lib/integrations/release-policy'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { completeGoogleConnection } from '@/lib/sites/connections/google'
import { getAuthBaseUrl } from '@/lib/auth/env'

export async function GET(request: NextRequest) {
  const base = getAuthBaseUrl().replace(/\/$/, '')
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  if (!session?.user?.id || !code || !state) {
    return NextResponse.redirect(`${base}/sign-in?next=/dashboard`)
  }
  if (integrationRelease('search-console') !== 'available' && integrationRelease('analytics') !== 'available')
    return NextResponse.redirect(`${base}/integrations`)
  try {
    const result = await completeGoogleConnection({
      state,
      code,
      sessionUserId: session.user.id,
    })
    if ('error' in result) return NextResponse.redirect(`${base}/dashboard`)
    return NextResponse.redirect(`${base}/sites/${result.projectId}?view=integrations#integrations`)
  } catch {
    return NextResponse.redirect(`${base}/dashboard`)
  }
}
