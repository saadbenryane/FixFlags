import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { adminRead } from '@/lib/admin/workspace-queries'
import { adminPrivateHeaders } from '@/lib/admin/http'
import { handleRouteError } from '@/lib/api/errors'
import { getEnv } from '@/lib/env'
export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 200),
      operators = await adminRead(actor, (db) =>
        db.user.findMany({
          where: {
            lifecycleStatus: 'ACTIVE',
            AND: [
              { OR: [{ role: 'admin' }, { id: { in: getEnv().ADMIN_USER_IDS } }] },
              ...(q
                ? [
                    {
                      OR: [
                        { email: { contains: q, mode: 'insensitive' as const } },
                        { name: { contains: q, mode: 'insensitive' as const } },
                        { id: q },
                      ],
                    },
                  ]
                : []),
            ],
          },
          select: { id: true, name: true, email: true },
          orderBy: [{ email: 'asc' }, { id: 'asc' }],
          take: 51,
        }),
      )
    return NextResponse.json(
      { operators: operators.slice(0, 50), hasMore: operators.length > 50 },
      { headers: adminPrivateHeaders },
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
