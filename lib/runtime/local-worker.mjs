import { hostname } from 'node:os'
import { realpathSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

export const LOCAL_WORKER_LEASE_KEY = 'fixflags:local:worker-owner'
export const LEASE_TTL_MS = 45_000
export const LEASE_RENEW_MS = 15_000
const RENEW = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end"
const RELEASE = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"

/** @param {string} workerId @param {string | null} runtimeId */
export function localWorkerOwner(workerId, runtimeId = null) {
  return { token: randomUUID(), workerId, runtimeId, hostname: hostname(), checkout: realpathSync(process.cwd()), pid: process.pid, startedAt: Date.now() }
}

export async function readLocalWorkerOwner(redis) {
  const raw = await redis.get(LOCAL_WORKER_LEASE_KEY)
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value.checkout !== 'string' || typeof value.hostname !== 'string' || typeof value.workerId !== 'string') throw new Error()
    return { workerId: value.workerId, runtimeId: value.runtimeId, hostname: value.hostname, checkout: value.checkout, pid: value.pid, startedAt: value.startedAt }
  } catch { throw new Error('Local worker ownership record is invalid. Wait for its lease to expire; no process was stopped.') }
}

export function workerConflict(owner) {
  if (!owner) return 'An unmanaged worker has a fresh heartbeat on this Redis. Stop its owning terminal with Ctrl+C. No process was stopped.'
  const action = owner.runtimeId ? `Run npm run dev:stop from ${owner.checkout}.` : 'Stop its owning worker terminal with Ctrl+C.'
  return `Worker ${owner.workerId} is owned by ${owner.hostname}, PID ${owner.pid}, checkout ${owner.checkout}. ${action} No process was stopped.`
}

export async function freshWorkerHeartbeats(redis, now = Date.now()) {
  let cursor = '0'
  const records = []
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'fixflags:worker:heartbeat:*', 'COUNT', 100)
    cursor = next
    if (!keys.length) continue
    for (const raw of await redis.mget(...keys)) {
      try {
        const record = JSON.parse(raw)
        if (record && typeof record.workerId === 'string' && Number.isFinite(record.lastSeenMs) &&
          now >= record.lastSeenMs && now - record.lastSeenMs <= LEASE_TTL_MS) records.push(record)
      } catch { /* Malformed records cannot establish liveness. */ }
    }
  } while (cursor !== '0')
  return records
}

/** One lease per Redis database. A previous owner cannot renew or delete a replacement. */
export async function acquireLocalWorkerLease(redis, owner, onLost, timing = {}) {
  const ttlMs = timing.ttlMs ?? LEASE_TTL_MS
  const renewMs = timing.renewMs ?? LEASE_RENEW_MS
  const value = JSON.stringify(owner)
  if (await redis.set(LOCAL_WORKER_LEASE_KEY, value, 'PX', ttlMs, 'NX') !== 'OK') {
    throw new Error(workerConflict(await readLocalWorkerOwner(redis)))
  }
  let stopped = false, lost = false, pending = null
  const timer = setInterval(() => {
    if (stopped || pending || lost) return
    pending = redis.eval(RENEW, 1, LOCAL_WORKER_LEASE_KEY, value, ttlMs)
      .then(result => { if (Number(result) !== 1) throw new Error('Local worker ownership lease was replaced') })
      .catch(error => { lost = true; onLost(error) })
      .finally(() => { pending = null })
  }, renewMs)
  timer.unref?.()
  return {
    async release() {
      stopped = true
      clearInterval(timer)
      await pending
      await redis.eval(RELEASE, 1, LOCAL_WORKER_LEASE_KEY, value)
    },
  }
}
