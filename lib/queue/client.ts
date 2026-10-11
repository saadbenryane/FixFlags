import { Queue } from 'bullmq'
import { createQueueRedis } from './redis'
import { logger } from '@/lib/logger'
import type Redis from 'ioredis'
import { TASK_QUEUES, type TaskQueue } from '@/lib/audit/progressive/queues'

let _auditQueue: Queue | null = null
let _auditRedis: Redis | null = null
const taskQueues = new Map<TaskQueue, Queue>()

export function getAuditTaskQueue(resource: TaskQueue): Queue {
  const existing = taskQueues.get(resource)
  if (existing) return existing
  const queue = new Queue(TASK_QUEUES[resource].name, { connection: getAuditRedis(),
    defaultJobOptions: { attempts: 1, removeOnComplete: { count: 1000, age: 7 * 24 * 3600 }, removeOnFail: { count: 5000, age: 30 * 24 * 3600 } } })
  queue.on('error', error => logger.error('Execution task queue unavailable', { resource, error: error.message }))
  taskQueues.set(resource, queue)
  return queue
}

function getAuditRedis(): Redis {
  if (!_auditRedis) {
    _auditRedis = createQueueRedis()
  }
  return _auditRedis
}

export function getAuditQueue(): Queue {
  if (!_auditQueue) {
    _auditQueue = new Queue('audit', {
      connection: getAuditRedis(),
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
