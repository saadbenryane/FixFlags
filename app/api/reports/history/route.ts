import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import {
  InvalidReportHistoryCursorError,
  loadReportHistory,
} from '@/lib/audit/report-history'

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) return apiError('Sign in to view report history', 401)
    const cursor = req.nextUrl.searchParams.get('cursor')
    return NextResponse.json(await loadReportHistory({ userId: session.user.id, cursor }))
  } catch (error) {
    if (error instanceof InvalidReportHistoryCursorError) {
      return apiError('Invalid report history cursor', 400)
    }
    return handleRouteError(error, 'Report history unavailable')
  }
}
