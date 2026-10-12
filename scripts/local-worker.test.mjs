import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { acquireLocalWorkerLease, LOCAL_WORKER_LEASE_KEY, freshWorkerHeartbeats, localWorkerOwner } from '../lib/runtime/local-worker.mjs'
import { localReadiness } from '../lib/runtime/readiness.mjs'

function fakeRedis() {
  const values = new Map()
  return {
    values,
    async set(key, value, _px, _ttl, nx) { if (nx === 'NX' && values.has(key)) return null; values.set(key, value); return 'OK' },
    async get(key) { return values.get(key) ?? null },
    async eval(script, _n, key, value) {
      if (values.get(key) !== value) return 0
      if (script.includes("'del'")) values.delete(key)
      return 1
    },
    async scan() { return ['0', [...values.keys()].filter(k => k.startsWith('fixflags:worker:heartbeat:'))] },
    async mget(...keys) { return keys.map(k => values.get(k) ?? null) },
  }
}
test('competing workers cannot acquire the same lease', async () => {
  const redis = fakeRedis()
  const first = await acquireLocalWorkerLease(redis, localWorkerOwner('first'), () => {})
  try { await assert.rejects(acquireLocalWorkerLease(redis, localWorkerOwner('second'), () => {}), /owned by/) }
  finally { await first.release() }
  assert.equal(await redis.get(LOCAL_WORKER_LEASE_KEY), null)
})
test('a previous owner cannot delete its replacement, and detects renewal loss', async () => {
  const redis = fakeRedis()
  let lost = false
  const first = await acquireLocalWorkerLease(redis, localWorkerOwner('first'), () => { lost = true }, { renewMs: 5 })
  redis.values.delete(LOCAL_WORKER_LEASE_KEY)
  const second = await acquireLocalWorkerLease(redis, localWorkerOwner('second'), () => {})
  try {
    await delay(25)
    assert.equal(lost, true)
    await first.release()
    assert.equal(JSON.parse(await redis.get(LOCAL_WORKER_LEASE_KEY)).workerId, 'second')
  } finally { await first.release(); await second.release() }
})
test('only valid fresh heartbeat records establish liveness', async () => {
  const redis = fakeRedis(), now = Date.now()
  for (const [name, raw] of Object.entries({ live: JSON.stringify({ workerId: 'live', lastSeenMs: now }), stale: JSON.stringify({ workerId: 'stale', lastSeenMs: now - 46_000 }), corrupt: 'not-json', future: JSON.stringify({workerId: 'future', lastSeenMs: now + 1000}) })) redis.values.set('fixflags:worker:heartbeat:' + name, raw)
  assert.deepEqual((await freshWorkerHeartbeats(redis, now)).map(r => r.workerId), ['live'])
})
test('readiness requires the intended worker, its browser and initialized queues', () => {
  const health = { redis: 'ok', worker: { alive: true, browserOk: true, workerCount: 1, workers: [{ workerId: 'ours', queueState: 'idle' }] } }
  assert.equal(localReadiness(health, 'ours').ready, true)
  assert.equal(localReadiness(health, 'other').ready, false)
  assert.equal(localReadiness({ ...health, worker: { ...health.worker, browserOk: false } }, 'ours').ready, false)
  health.worker.workers[0].queueState = 'stopping'
  assert.equal(localReadiness(health, 'ours').ready, false)
})
