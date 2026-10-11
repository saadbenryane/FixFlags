import type { Redis } from 'ioredis'
import { createQueueRedis } from './redis'
import { randomUUID } from 'node:crypto'

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

/** Renewal uses the same token so an expired scheduler cannot renew or release
 * its replacement. Task publication still requires the database execution fence. */
export async function withSchedulerLease(name: string, run: (signal: AbortSignal) => Promise<void>, ttlMs = 30_000): Promise<boolean> {
  const redis = getLockRedis(), key = 'fixflags:lease:' + name, token = randomUUID()
  const controller = new AbortController()
  let renewing = false
  try {
    if (await redis.set(key, token, 'PX', ttlMs, 'NX') !== 'OK') return false
  } catch { return false }
  const timer = setInterval(() => {
    if (renewing || controller.signal.aborted) return
    renewing = true
    void redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
      1, key, token, ttlMs).then(result => { if (Number(result) !== 1) controller.abort() }, () => controller.abort())
      .finally(() => { renewing = false })
  }, Math.floor(ttlMs / 3))
  timer.unref?.()
  try { await run(controller.signal); return true }
  finally {
    clearInterval(timer); controller.abort()
    try {
      await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, key, token)
    } catch { /* Its bounded lease expires; never delete another scheduler's lease. */ }
  }
}
