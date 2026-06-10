import { Queue } from 'bullmq'

function getRedisOptions() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  return {
    url: url.includes('?') ? url : `${url}?family=0`,
    maxRetriesPerRequest: null as unknown as undefined,
    enableReadyCheck: false,
    lazyConnect: true,
  }
}

let _auditQueue: Queue | null = null

export function getAuditQueue(): Queue {
  if (!_auditQueue) {
    _auditQueue = new Queue('audit', {
      connection: getRedisOptions(),
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
