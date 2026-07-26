import { createWorkerRedis } from './redis'
import { randomUUID } from 'node:crypto'
import type Redis from 'ioredis'

const HEARTBEAT_PREFIX = 'fixflags:worker:heartbeat:'
const STALLED_COUNT_KEY = 'fixflags:worker:stalled-count'
const HEARTBEAT_TTL_SECONDS = 45
const WORKER_ID =
  process.env.RAILWAY_REPLICA_ID ??
  process.env.FIXFLAGS_WORKER_ID ??
  randomUUID()

let redis: Redis | null = null
let stopping = false
let diagnostics: WorkerDiagnostics = {
  browserOk: false,
  activeBrowserContexts: 0,
}

function getRedis(): Redis {
  if (!redis) {
    redis = createWorkerRedis()
  }
  return redis
}

export interface WorkerDiagnostics {
  browserOk: boolean
  activeBrowserContexts: number
}

interface WorkerHeartbeatRecord extends WorkerDiagnostics {
  workerId: string
  lastSeenMs: number
  configuredConcurrency: number
}

/** Called by the worker process on start, idle tick, and each job lifecycle event. */
export async function touchWorkerHeartbeat(
  update?: Partial<WorkerDiagnostics>
): Promise<void> {
  if (stopping) return
  diagnostics = { ...diagnostics, ...update }
  const record: WorkerHeartbeatRecord = {
    workerId: WORKER_ID,
    lastSeenMs: Date.now(),
    configuredConcurrency: configuredWorkerConcurrency(),
    ...diagnostics,
  }
  await getRedis().set(
    `${HEARTBEAT_PREFIX}${WORKER_ID}`,
    JSON.stringify(record),
    'EX',
    HEARTBEAT_TTL_SECONDS
  )
}

export interface WorkerHeartbeatStatus {
  alive: boolean
  lastSeenMs: number | null
  ageSeconds: number | null
  workerCount: number
  browserOk: boolean
  activeBrowserContexts: number
  configuredConcurrency: number
}

function configuredWorkerConcurrency(): number {
  const value = Number.parseInt(process.env.AUDIT_WORKER_CONCURRENCY ?? '', 10)
  return Number.isFinite(value) && value > 0
    ? value
    : process.env.NODE_ENV === 'production'
      ? 2
      : 1
}

export async function recordStalledJob(): Promise<void> {
  await getRedis().incr(STALLED_COUNT_KEY)
}

export async function readStalledJobCount(): Promise<number> {
  const value = await getRedis().get(STALLED_COUNT_KEY)
  const count = Number.parseInt(value ?? '0', 10)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export async function clearWorkerHeartbeat(): Promise<void> {
  stopping = true
  if (!redis) return
  const client = redis
  await client.del(`${HEARTBEAT_PREFIX}${WORKER_ID}`)
  client.disconnect()
  redis = null
}

async function listHeartbeatKeys(): Promise<string[]> {
  const client = getRedis()
  let cursor = '0'
  const keys: string[] = []
  do {
    const [next, page] = await client.scan(
      cursor,
      'MATCH',
      `${HEARTBEAT_PREFIX}*`,
      'COUNT',
      100
    )
    cursor = next
    keys.push(...page)
  } while (cursor !== '0')
  return keys
}

/** Read aggregate worker liveness from Redis (web process). */
export async function readWorkerHeartbeat(): Promise<WorkerHeartbeatStatus> {
  const keys = await listHeartbeatKeys()
  if (keys.length === 0) {
    return {
      alive: false,
      lastSeenMs: null,
      ageSeconds: null,
      workerCount: 0,
      browserOk: false,
      activeBrowserContexts: 0,
      configuredConcurrency: 0,
    }
  }
  const values = await getRedis().mget(...keys)
  const now = Date.now()
  const records = values.flatMap((raw) => {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as WorkerHeartbeatRecord
      return Number.isFinite(parsed.lastSeenMs) ? [parsed] : []
    } catch {
      return []
    }
  })
  const aliveRecords = records.filter(
    (record) => now - record.lastSeenMs <= HEARTBEAT_TTL_SECONDS * 1000
  )
  if (aliveRecords.length === 0) {
    return {
      alive: false,
      lastSeenMs: null,
      ageSeconds: null,
      workerCount: 0,
      browserOk: false,
      activeBrowserContexts: 0,
      configuredConcurrency: 0,
    }
  }
  const lastSeenMs = Math.max(...aliveRecords.map((record) => record.lastSeenMs))
  return {
    alive: true,
    lastSeenMs,
    ageSeconds: Math.round((now - lastSeenMs) / 1000),
    workerCount: aliveRecords.length,
    browserOk: aliveRecords.every((record) => record.browserOk),
    activeBrowserContexts: aliveRecords.reduce(
      (total, record) => total + record.activeBrowserContexts,
      0
    ),
    configuredConcurrency: aliveRecords.reduce(
      (total, record) =>
        total +
        (Number.isFinite(record.configuredConcurrency)
          ? record.configuredConcurrency
          : 1),
      0
    ),
  }
}
