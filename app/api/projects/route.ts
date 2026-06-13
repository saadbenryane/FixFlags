import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { projectLimitForPlan } from '@/lib/billing/plans'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
})

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { audits: true } },
    },
  })

  return NextResponse.json(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      monitoringEnabled: p.monitoringEnabled,
      auditCount: p._count.audits,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = projectLimitForPlan(user.plan)
  if (limit === 0) {
    return NextResponse.json(
      { error: 'Projects require Team or Studio plan' },
      { status: 402 }
    )
  }

  const count = await prisma.project.count({ where: { userId: user.id } })
  if (count >= limit) {
    return NextResponse.json(
      { error: `Project limit reached (${limit} on ${user.plan})` },
      { status: 402 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid project data' }, { status: 400 })
  }

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name.trim(),
      url: parsed.data.url.trim(),
    },
  })

  return NextResponse.json(project, { status: 201 })
}
