import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { issueProductSignalKey } from '@/lib/signals/product-signals'

const createSchema = z.object({
  name: z.string().trim().min(1).max(80).default('Browser snippet'),
  allowedOrigin: z.string().url(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

async function owner(context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return null
  const { id } = await context.params
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  return project ? { userId: session.user.id, projectId: id } : null
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await owner(context)
    if (!access) return apiError('Product not found', 404)
    const keys = await prisma.productSignalKey.findMany({
      where: { projectId: access.projectId, revokedAt: null },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastFour: true,
        allowedOrigin: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ keys })
  } catch (error) {
    return handleRouteError(error, 'Could not load Product Signal keys')
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await owner(context)
    if (!access) return apiError('Product not found', 404)
    const requestHeaders = await headers()
    await enforceRateLimit({
      scope: 'product-signal-keys',
      identifier: `${access.userId}:${requestClientId(requestHeaders)}`,
      limit: 10,
      windowSeconds: 60,
    })
    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Enter a valid Product origin', 400)
    const key = await issueProductSignalKey({ ...access, ...parsed.data })
    return NextResponse.json(key, { status: 201 })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Product must have a completed Review before Watch setup'
    ) {
      return apiError('Complete a useful Product Review before keeping FixFlags watching', 409)
    }
    if (error instanceof Error && error.message === 'Product Signal key limit reached') {
      return apiError('Revoke an existing Product Signal key before creating another', 409)
    }
    if (error instanceof Error && error.message.includes('Product Watch access')) {
      return apiError('Upgrade to Pro or Studio to use Product Signals', 403)
    }
    return handleRouteError(error, 'Could not create Product Signal key')
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const access = await owner(context)
    if (!access) return apiError('Product not found', 404)
    const keyId = new URL(request.url).searchParams.get('keyId')
    if (!keyId) return apiError('Signal key id is required', 400)
    await prisma.productSignalKey.updateMany({
      where: { id: keyId, projectId: access.projectId },
      data: { revokedAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not revoke Product Signal key')
  }
}
