import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import type { UsageLimitAction, UsageLimitCode } from '@/lib/audit/usage'

export interface ApiErrorBody {
  error: string
  code?: UsageLimitCode | string
  action?: UsageLimitAction | string
}

export function apiError(
  message: string,
  status = 500,
  extras?: Pick<ApiErrorBody, 'code' | 'action'>
) {
  return NextResponse.json({ error: message, ...extras }, { status })
}

export function handleRouteError(err: unknown, fallback = 'Something went wrong'): NextResponse {
  console.error(err)

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return apiError('A record with this value already exists', 409)
    }
    if (err.code === 'P2025') {
      return apiError('Record not found', 404)
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return apiError('Database is not configured. Check DATABASE_URL and run migrations.', 503)
  }

  if (err instanceof Error) {
    if (err.message.includes('REDIS_URL')) {
      return apiError('Queue is not configured. Check REDIS_URL.', 503)
    }
    return apiError(err.message || fallback, 500)
  }

  return apiError(fallback, 500)
}

export interface ParsedApiError {
  message: string
  code?: string
  action?: string
}

/** Safely parse JSON error body from a fetch Response. */
export async function parseApiErrorResponse(res: Response): Promise<ParsedApiError> {
  try {
    const data = (await res.json()) as ApiErrorBody
    if (data && typeof data.error === 'string') {
      return {
        message: data.error,
        code: typeof data.code === 'string' ? data.code : undefined,
        action: typeof data.action === 'string' ? data.action : undefined,
      }
    }
  } catch {
    // non-JSON body
  }

  let message = 'Something went wrong. Please try again.'
  if (res.status === 503) message = 'Service temporarily unavailable. Check server configuration.'
  if (res.status === 402) message = 'Scan limit reached.'
  if (res.status === 400) message = 'Invalid request.'

  return { message }
}
