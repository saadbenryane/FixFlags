import { createQueueRedis } from './redis'
import { createQueueProducer } from './bullmq-ownership'
import { logger } from '@/lib/logger'
import type Redis from 'ioredis'
import { TASK_QUEUES, type TaskQueue } from '@/lib/audit/progressive/queues'

let _auditRedis: Redis | null = null
const taskQueues = new Map<TaskQueue, ReturnType<typeof createQueueProducer>>()

/** Read the administrative lane without importing its privileged action handlers. */
export const getAdminOperationQueue = createQueueProducer('admin-operations', { connection: getAuditRedis,
  onError: error => logger.error('Admin queue diagnostics unavailable', { message: error.message }),
}).get

export function getAuditTaskQueue(resource: TaskQueue) {
  let producer = taskQueues.get(resource)
  if (!producer) {
    producer = createQueueProducer(TASK_QUEUES[resource].name, { connection: getAuditRedis,
      defaultJobOptions: { attempts: 1, removeOnComplete: { count: 1000, age: 7 * 24 * 3600 }, removeOnFail: { count: 5000, age: 30 * 24 * 3600 } },
      onError: error => logger.error('Execution task queue unavailable', { resource, error: error.message }),
    })
    taskQueues.set(resource, producer)
  }
  return producer.get()
}

function getAuditRedis(): Redis {
  if (!_auditRedis) {
    _auditRedis = createQueueRedis()
  }
  return _auditRedis
}

/** Recovery can reconcile PostgreSQL while the shared producer reconnects. */
export function isAuditTaskTransportReady() {
  const redis = getAuditRedis()
  if (redis.status === 'wait') void redis.connect().catch(() => { /* Connection errors are logged by the client. */ })
  return redis.status === 'ready'
}

export const getAuditQueue = createQueueProducer('audit', { connection: getAuditRedis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10_000 },
    removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
    removeOnFail: { count: 5000, age: 30 * 24 * 3600 },
  },
  onError: error => logger.error('Audit queue error', error),
}).get
