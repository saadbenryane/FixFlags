import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { isWatchInterval, setProjectWatch } from '@/lib/audit/project-watch'
import { canAccessProductWatch } from '@/lib/auth/entitlements'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

const bodySchema = z.object({
  interval: z.enum(['weekly', 'daily']).nullable(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user) return apiError('Sign in required', 401, { code: 'UNAUTHORIZED' })

    const project = await prisma.project.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        url: true,
        watchInterval: true,
        watchNextRunAt: true,
        watchLastRunAt: true,
      },
    })
    if (!project) return apiError('Project not found', 404)

    return NextResponse.json({
      projectId: project.id,
      url: project.url,
      watchInterval: isWatchInterval(project.watchInterval) ? project.watchInterval : null,
      watchNextRunAt: project.watchNextRunAt,
      watchLastRunAt: project.watchLastRunAt,
    })
  } catch (err) {
    return handleRouteError(err, 'Could not load product watch')
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user) return apiError('Sign in required', 401, { code: 'UNAUTHORIZED' })

    const clientId = requestClientId(await headers())
    await enforceRateLimit({
      scope: 'project-watch',
      identifier: `${session.user.id}:${clientId}`,
      limit: 20,
      windowSeconds: 60,
    })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, plan: true, role: true, subscriptionStatus: true },
    })
    if (!user) return apiError('Account not found', 401)

    const body = bodySchema.safeParse(await req.json().catch(() => null))
    if (!body.success) {
      return apiError('interval must be weekly, daily, or null', 400)
    }

    if (body.data.interval && !canAccessProductWatch(user)) {
      return apiError('Product watch requires Pro or Agency', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'view_pricing',
      })
    }

    if (body.data.interval === 'daily' && user.plan !== 'TEAM' && user.role !== 'admin') {
      return apiError('Daily watch requires Agency', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'view_pricing',
      })
    }

    const result = await setProjectWatch({
      projectId: id,
      userId: user.id,
      interval: body.data.interval,
    })
    if (!result.ok) return apiError(result.error, 400)

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        watchInterval: true,
        watchNextRunAt: true,
        watchLastRunAt: true,
      },
    })

    return NextResponse.json({
      watchInterval: project?.watchInterval ?? null,
      watchNextRunAt: project?.watchNextRunAt ?? null,
      watchLastRunAt: project?.watchLastRunAt ?? null,
    })
  } catch (err) {
    return handleRouteError(err, 'Could not update product watch')
  }
}
