import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isAdminUser } from '@/lib/auth/permissions'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })
  if (!admin || !isAdminUser(admin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const order = await prisma.expertReviewOrder.update({
    where: { id },
    data: { status: 'FULFILLED' },
  })

  return NextResponse.json({ order })
}
