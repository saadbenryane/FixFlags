import './load-env'
import { validateWorkerEnv } from '../lib/env'
import { startWorker } from '../lib/queue/worker'
import { startRecoveryScheduler } from '../lib/queue/recovery-scheduler'
import { closeBrowser } from '../lib/audit/screenshot'
import { getAuditBrowser, getBrowserDiagnostics } from '../lib/audit/screenshot'
import {
  clearWorkerHeartbeat,
  readWorkerHeartbeat,
  touchWorkerHeartbeat,
} from '../lib/queue/worker-heartbeat'
import { prisma } from '../lib/db'
import { createQueueRedis } from '../lib/queue/redis'
import { checkR2Connection } from '../lib/storage/r2'
import { isProdStorageConfigured } from '../lib/env'
import { logger } from '../lib/logger'
import { createWorkerRuntime } from './runtime'

const runtime = createWorkerRuntime({
  validateEnvironment: validateWorkerEnv,
  preflight: async () => {
    await prisma.$queryRaw`SELECT 1`
    const redis = createQueueRedis()
    try {
      await redis.connect()
      await redis.ping()
    } finally {
      redis.disconnect()
    }
    if (process.env.NODE_ENV === 'production') {
      if (!isProdStorageConfigured()) throw new Error('Worker storage configuration is incomplete')
      await checkR2Connection()
    }
    if (process.env.NODE_ENV !== 'production' && process.env.FIXFLAGS_ALLOW_DUPLICATE_WORKERS !== '1') {
      const heartbeat = await readWorkerHeartbeat()
      if (heartbeat.alive) {
        throw new Error('Another local worker is already alive. Set FIXFLAGS_ALLOW_DUPLICATE_WORKERS=1 for intentional concurrency.')
      }
    }
  },
  warmBrowser: async () => {
    await getAuditBrowser()
  },
  readBrowserDiagnostics: getBrowserDiagnostics,
  touchHeartbeat: touchWorkerHeartbeat,
  clearHeartbeat: clearWorkerHeartbeat,
  startWorker,
  startScheduler: startRecoveryScheduler,
  closeBrowser,
  exit: (code) => process.exit(code),
  logger,
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in worker', {
    error: reason instanceof Error ? reason.message : String(reason),
  })
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker', { error: error.message })
  void runtime.shutdown(1)
})

process.on('SIGTERM', () => void runtime.shutdown())
process.on('SIGINT', () => void runtime.shutdown())

void runtime.start().catch((error) => {
  logger.error('Worker failed to start', {
    error: error instanceof Error ? error.message : String(error),
  })
  void runtime.shutdown(1)
})
