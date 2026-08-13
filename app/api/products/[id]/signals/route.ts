import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { ingestProductSignals, normalizeSignalOrigin } from '@/lib/signals/product-signals'

interface RouteContext {
  params: Promise<{ id: string }>
}

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin',
  }
}

export async function OPTIONS(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const origin = normalizeSignalOrigin(request.headers.get('origin') ?? '')
    const allowed = await prisma.productSignalKey.findFirst({
      where: { projectId: id, allowedOrigin: origin, revokedAt: null },
      select: { id: true },
    })
    if (!allowed) return new NextResponse(null, { status: 403 })
    return new NextResponse(null, { status: 204, headers: cors(origin) })
  } catch {
    return new NextResponse(null, { status: 403 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  const originHeader = request.headers.get('origin')
  try {
    if (!originHeader) return apiError('Product Signal origin is required', 403)
    const length = Number(request.headers.get('content-length') ?? 0)
    if (length > 100_000) return apiError('Product Signal batch is too large', 413)

    const text = await request.text()
    if (text.length > 100_000) return apiError('Product Signal batch is too large', 413)
    const payload = JSON.parse(text) as unknown
    const { id } = await context.params
    await enforceRateLimit({
      scope: 'product-signals',
      identifier: `${id}:${requestClientId(request.headers)}`,
      limit: 120,
      windowSeconds: 60,
      onRedisDown: 'reject',
    })
    const result = await ingestProductSignals({
      projectId: id,
      origin: originHeader,
      payload,
    })
    return NextResponse.json(result, { status: 202, headers: cors(normalizeSignalOrigin(originHeader)) })
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return apiError('Malformed Product Signal batch', 400)
    }
    if (
      error instanceof Error &&
      (error.message.includes('Invalid Product Signal') ||
        error.message.includes('Product Watch access') ||
        error.message.includes('Signal origin') ||
        error.message.includes('Signal route'))
    ) {
      return apiError(error.message, 403)
    }
    if (error instanceof Error && error.message.includes('timestamp')) {
      return apiError(error.message, 400)
    }
    return handleRouteError(error, 'Could not accept Product Signals')
  }
}
