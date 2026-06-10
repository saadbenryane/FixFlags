import Redis from 'ioredis'

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    })
  }
  return _redis
}

/**
 * Sliding-window counter. Returns true if the action is allowed.
 * Fails open if Redis is unreachable so the queue path stays usable.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const redis = getRedis()
    const redisKey = `ratelimit:${key}`
    const count = await redis.incr(redisKey)
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds)
    }
    return count <= limit
  } catch (err) {
    console.error('Rate limit check failed, allowing request:', err)
    return true
  }
}
