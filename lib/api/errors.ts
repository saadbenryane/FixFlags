import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
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

/** Safely parse JSON error body from a fetch Response. */
export async function parseApiErrorResponse(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (data && typeof data.error === 'string') return data.error
  } catch {
    // non-JSON body
  }
  if (res.status === 503) return 'Service temporarily unavailable. Check server configuration.'
  if (res.status === 402) return 'Audit limit reached. Upgrade to continue.'
  if (res.status === 400) return 'Invalid request.'
  return 'Something went wrong. Please try again.'
}
