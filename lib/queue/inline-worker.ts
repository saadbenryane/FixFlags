import { startWorker } from './worker'
import { startRecoveryScheduler } from './recovery-scheduler'
import { closeBrowser } from '@/lib/audit/screenshot'
import { logger } from '@/lib/logger'

let started = false

/**
 * Run an audit worker + recovery scheduler inside the current (web) process, so
 * a single service can both serve HTTP and process scans out of the box.
 *
 * Controlled by INLINE_WORKER: enabled by default; set it to 'false' on the web
 * service when running dedicated worker services instead. The whole thing is
 * guarded and wrapped so a worker problem can never take down the web server,
 * and it only runs in the Node.js server runtime (never during build or on the
 * edge runtime). Idempotent; safe to call from instrumentation on every boot.
 */
export function startInlineWorkerOnce(): void {
  if (started) return
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (process.env.INLINE_WORKER === 'false') return
  // The worker needs the database and queue; without them, stay web-only.
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) return
  started = true

  try {
    const worker = startWorker()
    startRecoveryScheduler()
    logger.info('Inline worker started')

    const shutdown = async () => {
      try {
        await worker.close()
        await closeBrowser()
      } catch {
        // best-effort shutdown
      }
    }
    process.once('SIGTERM', shutdown)
    process.once('SIGINT', shutdown)
  } catch (err) {
    logger.error(
      'Inline worker failed to start',
      err instanceof Error ? err : new Error(String(err))
    )
  }
}
