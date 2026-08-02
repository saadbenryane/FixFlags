import Redis from 'ioredis'
import { getRedisUrl } from '@/lib/env'
import { logger } from '@/lib/logger'

type RedisFailureMode = 'allow' | 'reject'

let redis: Redis | null = null

let _rateLimitRedisDown = false
let _rateLimitRedisDownAt: string | null = null
let _rateLimitRedisLastError: string | null = null

function getRateLimitRedis(): Redis {
  if (!redis) {
    redis = new Redis(getRedisUrl(), {
      // family: 0 resolves IPv4 + IPv6 (Railway's internal Redis is IPv6-only).
      family: 0,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    })
    redis.on('error', (err) => {
      logger.warn('Rate-limit Redis error', err.message)
    })
  }
  return redis
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function markRedisUnavailable(err: unknown) {
  _rateLimitRedisLastError = describeError(err)
  if (!_rateLimitRedisDown) {
    _rateLimitRedisDown = true
    _rateLimitRedisDownAt = new Date().toISOString()
    logger.error(
      '[rate-limit] Redis unavailable. Rate limiting is temporarily disabled.',
      err instanceof Error ? err : new Error(String(err))
    )
  } else {
    logger.warn('[rate-limit] Redis still unavailable while serving requests.', {
      lastError: _rateLimitRedisLastError,
      downSince: _rateLimitRedisDownAt,
    })
  }
}

function markRedisAvailable() {
  if (_rateLimitRedisDown || _rateLimitRedisDownAt || _rateLimitRedisLastError) {
    _rateLimitRedisDown = false
    _rateLimitRedisDownAt = null
    _rateLimitRedisLastError = null
    logger.info('[rate-limit] Redis recovered. Rate limiting is enabled again.')
  }
}

async function redisLimitWithFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  onRedisDown: RedisFailureMode
): Promise<T> {
  try {
    const value = await fn()
    markRedisAvailable()
    return value
  } catch (error) {
    markRedisUnavailable(error)
    if (onRedisDown === 'reject') {
      throw new RateLimitUnavailableError(30)
    }
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

export class RateLimitUnavailableError extends RateLimitError {
  constructor(retryAfter: number) {
    super(retryAfter)
    this.name = 'RateLimitUnavailableError'
    this.message =
      'Rate limit service is unavailable. Access is denied temporarily for safety.'
  }
}

export interface RateLimitResult {
  exceeded: boolean
  retryAfterSeconds: number
  currentCount: number
}

interface RateLimitInput {
  scope: string
  identifier: string
  limit: number
  windowSeconds: number
  onRedisDown?: RedisFailureMode
}

async function incrementRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const {
    scope,
    identifier,
    limit,
    windowSeconds,
    onRedisDown = 'allow',
  } = input

  return redisLimitWithFallback(async () => {
    const client = getRateLimitRedis()
    if (client.status === 'wait') await client.connect()

    const window = Math.floor(Date.now() / (windowSeconds * 1000))
    const key = `qos:rate:${scope}:${identifier}:${window}`
    const count = await client.incr(key)
    if (count === 1) await client.expire(key, windowSeconds + 5)

    if (count > limit) {
      const ttl = await client.ttl(key)
      return {
        exceeded: true,
        retryAfterSeconds: Math.max(1, ttl),
        currentCount: count,
      }
    }

    return { exceeded: false, retryAfterSeconds: 0, currentCount: count }
  }, { exceeded: false, retryAfterSeconds: 0, currentCount: 0 }, onRedisDown)
}

/** Record a hit and return whether the limit is exceeded (does not throw). */
export async function recordRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  return incrementRateLimit(input)
}

/** Hard gate for routes that must reject when over limit. */
export async function enforceRateLimit(input: RateLimitInput): Promise<void> {
  const result = await incrementRateLimit(input)
  if (result.exceeded) {
    throw new RateLimitError(result.retryAfterSeconds)
  }
}

export function getRateLimitRedisHealth(): {
  redisDown: boolean
  redisDownSince: string | null
  lastError: string | null
} {
  return {
    redisDown: _rateLimitRedisDown,
    redisDownSince: _rateLimitRedisDownAt,
    lastError: _rateLimitRedisLastError,
  }
}

export function requestClientId(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip') || 'unknown'
}
