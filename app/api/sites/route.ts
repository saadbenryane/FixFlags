import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { SITE_SUMMARY_OWNER_HEADER, SITE_SUMMARY_READ_AT_HEADER } from '@/lib/sites/summary-contract'

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to view Sites', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })
    const readAt = Date.now()
    return NextResponse.json(await loadSiteSummaries(session.user.id), { headers: {
      'Cache-Control': 'private, no-store', [SITE_SUMMARY_OWNER_HEADER]: session.user.id,
      [SITE_SUMMARY_READ_AT_HEADER]: String(readAt),
    } })
  } catch (error) {
    return handleRouteError(error, 'Could not load Sites')
  }
}
