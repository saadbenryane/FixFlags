import Redis from 'ioredis'
import { getRedisUrl } from '@/lib/env'

let redis: Redis | null = null

function getRateLimitRedis(): Redis {
  if (!redis) {
    redis = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    })
  }
  return redis
}

export class RateLimitError extends Error {
  readonly retryAfter: number

  constructor(retryAfter: number) {
    super('Too many requests. Please wait before trying again.')
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export async function enforceRateLimit(input: {
  scope: string
  identifier: string
  limit: number
  windowSeconds: number
}): Promise<void> {
  const client = getRateLimitRedis()
  if (client.status === 'wait') await client.connect()

  const window = Math.floor(Date.now() / (input.windowSeconds * 1000))
  const key = `qos:rate:${input.scope}:${input.identifier}:${window}`
  const count = await client.incr(key)
  if (count === 1) await client.expire(key, input.windowSeconds + 5)
  if (count > input.limit) {
    const ttl = await client.ttl(key)
    throw new RateLimitError(Math.max(1, ttl))
  }
}

export function requestClientId(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip') || 'unknown'
}
