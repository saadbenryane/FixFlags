import { describe, expect, it } from 'vitest'
import { createQueueRedis } from '../redis'
import { clearWorkerHeartbeat, touchWorkerHeartbeat, WORKER_ID } from '../worker-heartbeat'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('worker diagnostics through the actual Redis transport', () => {
  it('bounds an unanswered heartbeat command without retaining the diagnostic connection after cleanup', async () => {
    const database = new URL(process.env.DATABASE_URL!)
    const redisUrl = new URL(process.env.REDIS_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname) ||
      !['localhost', '127.0.0.1'].includes(redisUrl.hostname)) throw new Error('Use the disposable execution verifier')
    const control = createQueueRedis()
    try {
      await touchWorkerHeartbeat({ browserOk: false })
      // Redis accepts the control command but temporarily withholds ordinary
      // command replies. The real client deadline must reject the diagnostic.
      await control.call('CLIENT', 'PAUSE', '6000', 'ALL')
      await expect(touchWorkerHeartbeat({ queueState: 'active' })).rejects.toThrow(/Command timed out/i)
    } finally {
      try { await control.call('CLIENT', 'UNPAUSE') }
      finally {
        try {
          await clearWorkerHeartbeat()
          expect(await control.get('fixflags:worker:heartbeat:' + WORKER_ID)).toBeNull()
        } finally { control.disconnect() }
      }
    }
  }, 15_000)
})
