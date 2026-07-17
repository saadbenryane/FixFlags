import IORedis, { type Redis, type RedisOptions } from 'ioredis'
import { getRedisUrl } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * ioredis only parses connection details (host, port, auth, TLS) when the URL
 * is passed as the first *string* argument. A `url` key inside the options
 * object is silently ignored, and the client falls back to localhost:6379,
 * which fails in production with "Connection is closed.". Always build clients
 * from the URL string.
 *
 * `family: 0` lets ioredis resolve both IPv4 and IPv6 records, which is
 * required for Railway's IPv6-only internal Redis hostname.
 */
function createRedis(options: RedisOptions): Redis {
  const client = new IORedis(getRedisUrl(), { family: 0, ...options })
  // Log connection-level errors for observability; callers still see
  // command-level rejections.
  client.on('error', (err) => {
    logger.error('Redis connection error', err)
  })
  return client
}

/** Web/API connection. Lazy so the process can boot before Redis is reachable. */
export function createQueueRedis(): Redis {
  return createRedis({
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  })
}

/** Worker connection: eager so jobs process immediately. */
export function createWorkerRedis(): Redis {
  return createRedis({
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}
