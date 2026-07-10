import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  url: z.string().url().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to update projects', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'project-update', identifier: `${session.user.id}:${clientId}`, limit: 20, windowSeconds: 60 })

  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
      return apiError('Enter a valid name or URL', 400, { code: 'INVALID_PROJECT' })
  }

  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  })
    if (!existing) return apiError('Project not found', 404, { code: 'NOT_FOUND' })

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.url !== undefined ? { url: parsed.data.url.trim() } : {}),
    },
  })

    return NextResponse.json(project)
  } catch (error) {
    return handleRouteError(error, 'Could not update project')
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to delete projects', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

  const { id } = await context.params
  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  })
    if (!existing) return apiError('Project not found', 404, { code: 'NOT_FOUND' })

    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not delete project')
  }
}
