import './load-env'
import { validateWorkerEnv } from '../lib/env'
import { startWorker } from '../lib/queue/worker'
import { startRecoveryScheduler } from '../lib/queue/recovery-scheduler'
import { closeBrowser } from '../lib/audit/screenshot'
import { logger } from '../lib/logger'

validateWorkerEnv()

logger.info('Worker starting')

const worker = startWorker()
// Self-hosted periodic recovery (lock-guarded; safe across many workers).
startRecoveryScheduler()

async function shutdown() {
  logger.info('Worker shutting down')
  await worker.close()
  await closeBrowser()
  process.exit(0)
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in worker', {
    error: reason instanceof Error ? reason.message : String(reason),
  })
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker', { error: error.message })
  shutdown().finally(() => process.exit(1))
})

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

logger.info('Worker ready, listening for audit jobs')
