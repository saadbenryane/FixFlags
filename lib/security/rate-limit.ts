import Redis from 'ioredis'
import { getRedisUrl } from '@/lib/env'
import { logger } from '@/lib/logger'

let redis: Redis | null = null

function getRateLimitRedis(): Redis {
  if (!redis) {
    redis = new Redis(getRedisUrl(), {
      // family: 0 resolves IPv4 + IPv6 (Railway's internal Redis is IPv6-only).
      family: 0,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    })
    redis.on('error', () => {})
  }
  return redis
}

/** Run a Redis operation, falling open if the connection fails. */
async function redisFailOpen<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    logger.warn('Rate-limit Redis unavailable, allowing request', err instanceof Error ? err.message : String(err))
    return fallback
  }
}

export class RateLimitError extends Error {
  readonly retryAfter: number

  constructor(retryAfter: number) {
    super('Too many requests. Please wait before trying again.')
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export interface RateLimitResult {
  exceeded: boolean
  retryAfterSeconds: number
  currentCount: number
}

async function incrementRateLimit(input: {
  scope: string
  identifier: string
  limit: number
  windowSeconds: number
}): Promise<RateLimitResult> {
  return redisFailOpen(async () => {
    const client = getRateLimitRedis()
    if (client.status === 'wait') await client.connect()

    const window = Math.floor(Date.now() / (input.windowSeconds * 1000))
    const key = `qos:rate:${input.scope}:${input.identifier}:${window}`
    const count = await client.incr(key)
    if (count === 1) await client.expire(key, input.windowSeconds + 5)

    if (count > input.limit) {
      const ttl = await client.ttl(key)
      return {
        exceeded: true,
        retryAfterSeconds: Math.max(1, ttl),
        currentCount: count,
      }
    }

    return { exceeded: false, retryAfterSeconds: 0, currentCount: count }
  }, { exceeded: false, retryAfterSeconds: 0, currentCount: 0 })
}

/** Record a hit and return whether the limit is exceeded (does not throw). */
export async function recordRateLimit(input: {
  scope: string
  identifier: string
  limit: number
  windowSeconds: number
}): Promise<RateLimitResult> {
  return incrementRateLimit(input)
}

/** Hard gate for routes that must reject when over limit (prefer recordRateLimit + queue). */
export async function enforceRateLimit(input: {
  scope: string
  identifier: string
  limit: number
  windowSeconds: number
}): Promise<void> {
  const result = await incrementRateLimit(input)
  if (result.exceeded) {
    throw new RateLimitError(result.retryAfterSeconds)
  }
}

export function requestClientId(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip') || 'unknown'
}
