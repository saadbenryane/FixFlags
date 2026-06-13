import { Queue } from 'bullmq'
import { getRedisConnectionOptions } from './redis'

let _auditQueue: Queue | null = null

export function getAuditQueue(): Queue {
  if (!_auditQueue) {
    _auditQueue = new Queue('audit', {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 10_000 },
        removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
        removeOnFail: { count: 5000, age: 30 * 24 * 3600 },
      },
    })
  }
  return _auditQueue
}
