import './load-env'
import { validateWorkerEnv } from '../lib/env'
import { startWorker } from '../lib/queue/worker'
import { startRecoveryScheduler } from '../lib/queue/recovery-scheduler'
import { closeBrowser } from '../lib/audit/screenshot'
import { getAuditBrowser, getBrowserDiagnostics } from '../lib/audit/screenshot'
import {
  clearWorkerHeartbeat,
  touchWorkerHeartbeat,
} from '../lib/queue/worker-heartbeat'
import { logger } from '../lib/logger'

let worker: ReturnType<typeof startWorker> | null = null
let shuttingDown = false

async function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('Worker shutting down')
  await clearWorkerHeartbeat().catch(() => {})
  await closeBrowser()
  await worker?.close()
  process.exit(exitCode)
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in worker', {
    error: reason instanceof Error ? reason.message : String(reason),
  })
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker', { error: error.message })
  void shutdown(1)
})

process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())

async function main() {
  validateWorkerEnv()
  logger.info('Worker starting')

  await getAuditBrowser()
  const initialBrowser = getBrowserDiagnostics()
  await touchWorkerHeartbeat({
    browserOk: initialBrowser.connected,
    activeBrowserContexts: initialBrowser.activeContexts,
  })

  worker = startWorker()
  // Self-hosted periodic recovery (lock-guarded; safe across many workers).
  startRecoveryScheduler()
  logger.info('Worker ready, listening for audit jobs')
}

void main().catch((error) => {
  logger.error('Worker failed to start', {
    error: error instanceof Error ? error.message : String(error),
  })
  void shutdown(1)
})
