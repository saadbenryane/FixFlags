import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { listAdminSessions, serializeSession } from '@/lib/live-support'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const filter = req.nextUrl.searchParams.get('filter')
    const sessions = await listAdminSessions(
      filter === 'closed' ? 'closed' : filter === 'all' ? 'all' : 'open'
    )

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        ...serializeSession(s),
        lead: s.lead,
        user: s.user,
        project: s.project,
      })),
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
