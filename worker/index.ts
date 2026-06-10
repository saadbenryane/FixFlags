import 'dotenv/config'
import { startWorker } from '../lib/queue/worker'

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
