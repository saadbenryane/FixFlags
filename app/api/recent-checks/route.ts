import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return apiError('Sign in to view recent checks', 401)
    }

    const cursor = req.nextUrl.searchParams.get('cursor')

    const audits = await prisma.audit.findMany({
      where: { userId: session.user.id, parentId: null },
      include: {
        rubrics: {
          select: {
            name: true,
            grade: true,
            score: true,
            flags: { select: { severity: true } },
          },
        },
        monitoringAudits: {
          where: { status: 'COMPLETED' },
          select: { id: true, score: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = audits.length > PAGE_SIZE
    const items = hasMore ? audits.slice(0, PAGE_SIZE) : audits
    const nextCursor = hasMore ? items[items.length - 1]?.id : null

    return NextResponse.json({ audits: items, nextCursor, hasMore })
  } catch (err) {
    return handleRouteError(err)
  }
}
