import type { Redis } from 'ioredis'
import { createQueueRedis } from './redis'

let client: Redis | null = null

function getLockRedis(): Redis {
  if (!client) client = createQueueRedis()
  return client
}

/**
 * Best-effort distributed lock via `SET key val NX PX ttl`. Returns true only
 * for the caller that acquired it. The lock is not explicitly released; it
 * expires after `ttlMs`, so it doubles as a cross-instance rate limiter:
 * exactly one worker runs a given periodic job per window, no matter how many
 * workers are deployed. Never throws (a Redis blip just means "not acquired").
 */
export async function tryAcquireLock(name: string, ttlMs: number): Promise<boolean> {
  try {
    const res = await getLockRedis().set(
      `fixflags:lock:${name}`,
      String(Date.now()),
      'PX',
      ttlMs,
      'NX'
    )
    return res === 'OK'
  } catch {
    return false
  }
}
