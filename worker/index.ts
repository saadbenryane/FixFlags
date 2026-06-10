import 'dotenv/config'
import { startWorker } from '../lib/queue/worker'

const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'ANTHROPIC_API_KEY']
const missing = REQUIRED_ENV.filter((k) => !process.env[k])
if (missing.length > 0) {
  console.error(`Worker missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}

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
