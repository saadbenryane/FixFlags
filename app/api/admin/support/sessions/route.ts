import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { listAdminSessions, serializeSession } from '@/lib/live-support'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const filter = req.nextUrl.searchParams.get('filter')
    const requested = Number(req.nextUrl.searchParams.get('page') ?? 1)
    const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1
    const sessions = await listAdminSessions(
      filter === 'closed' ? 'closed' : filter === 'all' ? 'all' : 'open',
      page,
    )

    return NextResponse.json(
      {
        hasNext: sessions.length > 50,
        page,
        sessions: sessions.slice(0, 50).map((s) => ({
          ...serializeSession(s),
          lead: s.lead,
          user: s.user,
          project: s.project,
        })),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
