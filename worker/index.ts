import './load-env'
import { validateAuditEnv } from '../lib/env'
import { startWorker } from '../lib/queue/worker'
import { closeBrowser } from '../lib/audit/screenshot'
import { logger } from '../lib/logger'

validateAuditEnv()

logger.info('Worker starting')

const worker = startWorker()

const heartbeatInterval = setInterval(() => {
  void touchWorkerHeartbeat().catch((err) => {
    logger.error('Worker heartbeat tick failed', err)
  })
}, 15_000)

async function shutdown() {
  logger.info('Worker shutting down')
  clearInterval(heartbeatInterval)
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
