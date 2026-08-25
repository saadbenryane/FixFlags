import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import {
  fromStoredWatchInterval,
  productWatchReadiness,
  setProjectWatch,
} from '@/lib/audit/project-watch'
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
        watchLastAttemptAt: true,
        watchConsecutiveFailures: true,
        watchLastError: true,
      },
    })
    if (!project) return apiError('Project not found', 404)

    return NextResponse.json({
      projectId: project.id,
      url: project.url,
      watchInterval: fromStoredWatchInterval(project.watchInterval),
      watchNextRunAt: project.watchNextRunAt,
      watchLastRunAt: project.watchLastRunAt,
      watchLastAttemptAt: project.watchLastAttemptAt,
      watchConsecutiveFailures: project.watchConsecutiveFailures,
      watchLastError: project.watchLastError,
      readiness: productWatchReadiness(),
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

    const body = bodySchema.safeParse(await req.json().catch(() => null))
    if (!body.success) {
      return apiError('interval must be weekly, daily, or null', 400)
    }

    const result = await setProjectWatch({
      projectId: id,
      userId: session.user.id,
      interval: body.data.interval,
    })
    if (!result.ok) {
      const status = result.code === 'WATCH_UNAVAILABLE'
        ? 503
        : result.code === 'STUDIO_REQUIRED'
          ? 403
          : 400
      return apiError(result.error, status, {
        code: result.code ?? 'WATCH_UPDATE_FAILED',
      })
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        watchInterval: true,
        watchNextRunAt: true,
        watchLastRunAt: true,
        watchLastAttemptAt: true,
        watchConsecutiveFailures: true,
        watchLastError: true,
      },
    })

    return NextResponse.json({
      watchInterval: fromStoredWatchInterval(project?.watchInterval ?? null),
      watchNextRunAt: project?.watchNextRunAt ?? null,
      watchLastRunAt: project?.watchLastRunAt ?? null,
      watchLastAttemptAt: project?.watchLastAttemptAt ?? null,
      watchConsecutiveFailures: project?.watchConsecutiveFailures ?? 0,
      watchLastError: project?.watchLastError ?? null,
      readiness: productWatchReadiness(),
    })
  } catch (err) {
    return handleRouteError(err, 'Could not update product watch')
  }
}
