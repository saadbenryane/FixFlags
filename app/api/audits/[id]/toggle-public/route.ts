import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  const audit = await prisma.audit.findUnique({ where: { id }, select: { userId: true, isPublic: true } })
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  if (audit.userId && audit.userId !== session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updated = await prisma.audit.update({
    where: { id },
    data: { isPublic: !audit.isPublic },
    select: { isPublic: true },
  })

  return NextResponse.json(updated)
}
