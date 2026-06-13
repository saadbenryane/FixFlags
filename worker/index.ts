import 'dotenv/config'
import { validateAuditEnv } from '../lib/env'
import { startWorker } from '../lib/queue/worker'

validateAuditEnv()

console.log('QualityOS worker starting...')

const worker = startWorker()

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker...')
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await worker.close()
  process.exit(0)
})

console.log('Worker ready, listening for audit jobs')
