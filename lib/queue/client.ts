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
      connection: getAuditRedis() as unknown as ConstructorParameters<typeof Queue>[1]['connection'],
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
