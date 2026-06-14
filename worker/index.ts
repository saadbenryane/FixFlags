import './load-env'
import { validateAuditEnv } from '../lib/env'
import { startWorker } from '../lib/queue/worker'
import { closeBrowser } from '../lib/audit/screenshot'

validateAuditEnv()

console.log('QualityOS worker starting...')

const worker = startWorker()

async function shutdown() {
  console.log('Shutting down worker...')
  await worker.close()
  await closeBrowser()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

console.log('Worker ready, listening for audit jobs')
