import { Queue } from 'bullmq'
import { createQueueRedis } from './redis'
import { logger } from '@/lib/logger'
import type Redis from 'ioredis'

let _auditQueue: Queue | null = null
let _auditRedis: Redis | null = null

function getAuditRedis(): Redis {
  if (!_auditRedis) {
    _auditRedis = createQueueRedis()
  }
  return _auditRedis
}

export function getAuditQueue(): Queue {
  if (!_auditQueue) {
    _auditQueue = new Queue('audit', {
      // ioredis.Redis instances are accepted by BullMQ at runtime but TS
      // overload resolution resolves to QueueOptions|undefined which lacks
      // `connection` -- the cast bridges the runtime/type-system gap safely.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: getAuditRedis() as any,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 10_000 },
        removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
        removeOnFail: { count: 5000, age: 30 * 24 * 3600 },
      },
    })
    _auditQueue.on('error', (err) => {
      logger.error('Audit queue error', err)
    })
  }
  return _auditQueue
}
