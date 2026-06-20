import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { projectLimitForPlan } from '@/lib/billing/plans'
import { apiError, handleRouteError } from '@/lib/api/errors'

const schema = z.object({
  projectId: z.string().nullable(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to assign projects', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

  const { id } = await context.params
  const audit = await prisma.audit.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!audit || audit.userId !== session.user.id) {
      return apiError('Audit not found', 404, { code: 'NOT_FOUND' })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || projectLimitForPlan(user.plan) === 0) {
      return apiError('Projects require the Max plan', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'view_pricing',
      })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
      return apiError('Select a valid project', 400, { code: 'INVALID_PROJECT' })
  }

  if (parsed.data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, userId: session.user.id },
    })
    if (!project) {
        return apiError('Project not found', 404, { code: 'NOT_FOUND' })
    }
  }

  const updated = await prisma.audit.update({
    where: { id },
    data: { projectId: parsed.data.projectId },
    select: { id: true, projectId: true },
  })

    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error, 'Could not assign project')
  }
}
