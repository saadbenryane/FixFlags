import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { executeProductCommand } from '@/lib/products/application/commands'
import { loadProductWatch } from '@/lib/products/application/queries'
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

    const project = await loadProductWatch(id, session.user.id)
    if (!project) return apiError('Project not found', 404)
    return NextResponse.json(project)
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

    const result = await executeProductCommand({
      type: 'SET_WATCH',
      projectId: id,
      userId: session.user.id,
      interval: body.data.interval,
    })
    if (!result.ok) {
      const status = result.code === 'WATCH_UNAVAILABLE'
        ? 503
        : result.code === 'STUDIO_REQUIRED' || result.code === 'INTERVAL_NOT_ALLOWED'
          ? 403
          : 400
      return apiError(result.error, status, {
        code: result.code ?? 'WATCH_UPDATE_FAILED',
      })
    }

    const project = await loadProductWatch(id, session.user.id)
    if (!project) return apiError('Project not found', 404)
    return NextResponse.json(project)
  } catch (err) {
    return handleRouteError(err, 'Could not update product watch')
  }
}
