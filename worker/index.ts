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
import { createWorkerRuntime } from './runtime'

const runtime = createWorkerRuntime({
  validateEnvironment: validateWorkerEnv,
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
