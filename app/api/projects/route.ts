import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { projectLimitForPlan } from '@/lib/billing/plans'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
})

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to view projects', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

    const clientId = requestClientId(await headers())
    await recordRateLimit({ scope: 'api-projects', identifier: clientId, limit: 30, windowSeconds: 60 })

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
        auditCount: p._count.audits,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))
    )
  } catch (error) {
    return handleRouteError(error, 'Could not load projects')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to create a project', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return apiError('Account not found', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

  const limit = projectLimitForPlan(user.plan)
  if (limit === 0) {
      return apiError('Projects require the Agency plan', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'view_pricing',
      })
  }

  const count = await prisma.project.count({ where: { userId: user.id } })
  if (count >= limit) {
      return apiError(`Project limit reached (${limit})`, 402, {
        code: 'PROJECT_LIMIT',
        action: 'upgrade',
      })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
      return apiError('Enter a project name and valid public URL', 400, { code: 'INVALID_PROJECT' })
  }

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name.trim(),
      url: parsed.data.url.trim(),
    },
  })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Could not create project')
  }
}
