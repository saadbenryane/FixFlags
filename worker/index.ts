import './load-env'
import { validateAuditEnv } from '../lib/env'
import { startWorker } from '../lib/queue/worker'
import { closeBrowser } from '../lib/audit/screenshot'
import { logger } from '../lib/logger'

validateAuditEnv()

logger.info('Worker starting')

const worker = startWorker()

async function shutdown() {
  logger.info('Worker shutting down')
  await worker.close()
  await closeBrowser()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

logger.info('Worker ready, listening for audit jobs')
