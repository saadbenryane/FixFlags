import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: parentId } = await params

  const parent = await prisma.audit.findUnique({ where: { id: parentId } })
  if (!parent) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  // Paid users only
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to re-check audits' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || user.plan === 'FREE') {
    return NextResponse.json({ error: 'Upgrade to Builder to use re-check' }, { status: 402 })
  }

  const audit = await prisma.audit.create({
    data: {
      url: parent.url,
      userId: session.user.id,
      parentId,
      status: 'QUEUED',
    },
  })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { auditsUsed: { increment: 1 } },
  })

  await getAuditQueue().add('audit', { auditId: audit.id }, { jobId: audit.id })

  return NextResponse.json({ auditId: audit.id, status: 'QUEUED' }, { status: 201 })
}
