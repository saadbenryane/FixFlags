import { getWorkerRedisConnectionOptions } from './redis'
import Redis from 'ioredis'

const HEARTBEAT_KEY = 'fixflags:worker:heartbeat'
const HEARTBEAT_TTL_SECONDS = 45

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(getWorkerRedisConnectionOptions())
  }
  return redis
}

/** Called by the worker process on start, idle tick, and each job lifecycle event. */
export async function touchWorkerHeartbeat(): Promise<void> {
  await getRedis().set(HEARTBEAT_KEY, String(Date.now()), 'EX', HEARTBEAT_TTL_SECONDS)
}

export interface WorkerHeartbeatStatus {
  alive: boolean
  lastSeenMs: number | null
  ageSeconds: number | null
}

/** Read worker liveness from Redis (web process). */
export async function readWorkerHeartbeat(): Promise<WorkerHeartbeatStatus> {
  const raw = await getRedis().get(HEARTBEAT_KEY)
  if (!raw) {
    return { alive: false, lastSeenMs: null, ageSeconds: null }
  }
  const lastSeenMs = Number(raw)
  if (!Number.isFinite(lastSeenMs)) {
    return { alive: false, lastSeenMs: null, ageSeconds: null }
  }
  const ageSeconds = Math.round((Date.now() - lastSeenMs) / 1000)
  return {
    alive: ageSeconds <= HEARTBEAT_TTL_SECONDS,
    lastSeenMs,
    ageSeconds,
  }
}
