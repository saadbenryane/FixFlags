import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { projectLimitForPlan } from '@/lib/billing/plans'

const schema = z.object({
  projectId: z.string().nullable(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const audit = await prisma.audit.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!audit || audit.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || projectLimitForPlan(user.plan) === 0) {
    return NextResponse.json({ error: 'Projects require Team or Studio plan' }, { status: 402 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 })
  }

  if (parsed.data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, userId: session.user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  }

  const updated = await prisma.audit.update({
    where: { id },
    data: { projectId: parsed.data.projectId },
    select: { id: true, projectId: true },
  })

  return NextResponse.json(updated)
}
