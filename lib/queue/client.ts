import { Queue } from 'bullmq'
import { getRedisConnectionOptions } from './redis'
import Redis from 'ioredis'

let _auditQueue: Queue | null = null
let _auditRedis: Redis | null = null

function getAuditRedis(): Redis {
  if (!_auditRedis) {
    _auditRedis = new Redis(getRedisConnectionOptions())
    _auditRedis.on('error', () => {})
  }
  return _auditRedis
}

export function getAuditQueue(): Queue {
  if (!_auditQueue) {
    _auditQueue = new Queue('audit', {
      connection: getAuditRedis(),
      defaultJobOptions: {
        attempts: 1,
        backoff: { type: 'fixed', delay: 10_000 },
        removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
        removeOnFail: { count: 5000, age: 30 * 24 * 3600 },
      },
    })
  }
  return _auditQueue
}
