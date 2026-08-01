import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { listWaitlistRows, waitlistRowsToCsv } from '@/lib/billing/waitlist-segments'
import type { Plan } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const planParam = req.nextUrl.searchParams.get('plan')
    const plan =
      planParam === 'BUILDER' || planParam === 'TEAM' ? (planParam as Plan) : undefined
    const rows = await listWaitlistRows(plan)
    const csv = waitlistRowsToCsv(rows)
    const filename = `waitlist-${plan ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
