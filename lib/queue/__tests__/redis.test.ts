import { describe, it, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import { createQueueRedis, createWorkerRedis } from '@/lib/queue/redis'

// Regression guard: ioredis ignores a `url` key inside the options object and
// silently connects to localhost:6379, which fails in production with
// "Connection is closed.". These helpers must build clients from the URL
// string so they target the configured Redis host.
describe('queue redis connection', () => {
  const original = process.env.REDIS_URL

  beforeEach(() => {
    process.env.REDIS_URL = 'redis://default:secret@redis.railway.internal:6380'
  })

  afterEach(() => {
    if (original === undefined) delete process.env.REDIS_URL
    else process.env.REDIS_URL = original
  })

  it('queue client targets the configured host, not localhost', () => {
    const client = createQueueRedis()
    assert.equal(client.options.host, 'redis.railway.internal')
    assert.equal(client.options.port, 6380)
    assert.equal(client.options.family, 0)
    client.disconnect()
  })

  it('worker client targets the configured host with BullMQ-safe options', () => {
    const client = createWorkerRedis()
    assert.equal(client.options.host, 'redis.railway.internal')
    assert.equal(client.options.port, 6380)
    assert.equal(client.options.family, 0)
    // BullMQ requires null for blocking connections.
    assert.equal(client.options.maxRetriesPerRequest, null)
    client.disconnect()
  })
})
