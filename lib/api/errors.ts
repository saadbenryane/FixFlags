import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import type { UsageLimitAction, UsageLimitCode } from '@/lib/audit/usage'
import { randomUUID } from 'node:crypto'
import { RateLimitError } from '@/lib/security/rate-limit'
import { logger } from '@/lib/logger'
import { isSupportError } from '@/lib/live-support/errors'

export interface ApiErrorBody {
  code: UsageLimitCode | string
  message: string
  action?: UsageLimitAction | string
  requestId: string
}

export function apiError(
  message: string,
  status = 500,
  extras?: Partial<Pick<ApiErrorBody, 'code' | 'action' | 'requestId'>>
) {
  const requestId = extras?.requestId ?? randomUUID()
  return NextResponse.json(
    {
      code: extras?.code ?? `HTTP_${status}`,
      message,
      action: extras?.action,
      requestId,
    },
    { status }
  )
}

export function handleRouteError(err: unknown, fallback = 'Something went wrong'): NextResponse {
  const requestId = randomUUID()
  logger.error('API route error', err instanceof Error ? err : new Error(String(err)))

  if (isSupportError(err)) {
    return apiError(err.message, err.status, { code: err.code, requestId })
  }

  if (err instanceof RateLimitError) {
    const response = apiError(err.message, 429, {
      code: 'RATE_LIMITED',
      action: 'retry',
      requestId,
    })
    response.headers.set('Retry-After', String(err.retryAfter))
    return response
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return apiError('A record with this value already exists', 409, { requestId })
    }
    if (err.code === 'P2025') {
      return apiError('Record not found', 404, { requestId })
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return apiError('Database is not configured. Check DATABASE_URL and run migrations.', 503, {
      requestId,
    })
  }

  if (err instanceof Error) {
    if (err.message.includes('REDIS_URL')) {
      return apiError('Queue is not configured. Check REDIS_URL.', 503, { requestId })
    }
    return apiError(err.message || fallback, 500, { requestId })
  }

  return apiError(fallback, 500, { requestId })
}


