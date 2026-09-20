import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to view Sites', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })
    return NextResponse.json(await loadSiteSummaries(session.user.id))
  } catch (error) {
    return handleRouteError(error, 'Could not load Sites')
  }
}
