import { describe, expect, it } from 'vitest'
import {
  aggregateWorkerHeartbeats,
  type WorkerHeartbeatRecord,
} from '@/lib/queue/worker-heartbeat'

const now = 2_000_000

function heartbeat(
  workerId: string,
  overrides: Partial<WorkerHeartbeatRecord> = {}
): WorkerHeartbeatRecord {
  return {
    workerId,
    lastSeenMs: now - 1_000,
    configuredConcurrency: 1,
    browserOk: true,
    activeBrowserContexts: 0,
    ...overrides,
  }
}

describe('worker heartbeat aggregation', () => {
  it('aggregates every live replica and its active contexts', () => {
    expect(
      aggregateWorkerHeartbeats(
        [
          heartbeat('worker-a', { configuredConcurrency: 2, activeBrowserContexts: 1 }),
          heartbeat('worker-b', { configuredConcurrency: 3, activeBrowserContexts: 2 }),
        ],
        now
      )
    ).toMatchObject({
      alive: true,
      workerCount: 2,
      browserOk: true,
      activeBrowserContexts: 3,
      configuredConcurrency: 5,
    })
  })

  it('expires crashed replicas after the heartbeat TTL', () => {
    const status = aggregateWorkerHeartbeats(
      [
        heartbeat('expired', { lastSeenMs: now - 46_000 }),
        heartbeat('live', { lastSeenMs: now - 2_000 }),
      ],
      now
    )

    expect(status.workerCount).toBe(1)
    expect(status.lastSeenMs).toBe(now - 2_000)
  })

  it('fails browser readiness when any live replica is unready', () => {
    const status = aggregateWorkerHeartbeats(
      [heartbeat('ready'), heartbeat('unready', { browserOk: false })],
      now
    )

    expect(status.browserOk).toBe(false)
  })

  it('returns the stable empty contract when every heartbeat is expired', () => {
    expect(
      aggregateWorkerHeartbeats(
        [heartbeat('expired', { lastSeenMs: now - 60_000 })],
        now
      )
    ).toEqual({
      uptimeReady: false, accountChecksReady: false, accountConfigurationMatches: false,
      alive: false,
      lastSeenMs: null,
      ageSeconds: null,
      workerCount: 0,
      browserOk: false,
      activeBrowserContexts: 0,
      configuredConcurrency: 0,
      workers: [],
    })
  })
})


describe('uptime capability evidence', () => {
  it('requires a recent successful scheduler sweep from every live worker', () => {
    const ready = heartbeat('ready', { uptimeReady: true, lastUptimeSweepAt: new Date(now - 30_000).toISOString() })
    expect(aggregateWorkerHeartbeats([ready], now).uptimeReady).toBe(true)
    expect(aggregateWorkerHeartbeats([ready, heartbeat('old')], now).uptimeReady).toBe(false)
    expect(aggregateWorkerHeartbeats([{ ...ready, lastUptimeSweepAt: new Date(now - 91_000).toISOString() }], now).uptimeReady).toBe(false)
    expect(aggregateWorkerHeartbeats([{ ...ready, lastUptimeSweepAt: 'invalid' }], now).uptimeReady).toBe(false)
  })
})
