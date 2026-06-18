import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { getAdminUnreadCount } from '@/lib/live-support/sessions'

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const unreadByAgent = await getAdminUnreadCount()
    return NextResponse.json({ unreadByAgent })
  } catch (err) {
    return handleRouteError(err)
  }
}
