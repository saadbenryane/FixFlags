import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { markWaitlistInvited } from '@/lib/billing/waitlist'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    await markWaitlistInvited(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
