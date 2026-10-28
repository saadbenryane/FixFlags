import { runBestEffort } from '@/lib/observability/best-effort'
import { shutdownDeadlineMs } from '../lib/runtime/environment.mjs'

export interface WorkerHandle {
  waitUntilReady?(): Promise<unknown>
  close(): Promise<unknown>
}
export interface WorkerRuntimeLogger {
  info(message: string): void
  warn(message: string, details: Record<string, unknown>): void
  error(message: string, details?: unknown): void
}
export interface WorkerRuntimeDependencies {
  validateEnvironment(): void
  preflight(): Promise<void>
  beginShutdown?(): Promise<void>
  releaseOwnership?(): Promise<void>
  clearHeartbeat(): Promise<void>
  startWorker(): WorkerHandle
  startScheduler(): { stop(): Promise<unknown> } | void
  closeBrowser(): Promise<void>
  exit(code: number): void
  logger: WorkerRuntimeLogger
  onReady?(): void
  onStopping?(): void
  shutdownMs?: number
}

/** Supervise startup and draining without exposing process globals to tests. */
export function createWorkerRuntime(dependencies: WorkerRuntimeDependencies) {
  let worker: WorkerHandle | null = null
  let scheduler: ReturnType<WorkerRuntimeDependencies['startScheduler']>
  let shuttingDown = false, startPromise: Promise<void> | undefined, stopPromise: Promise<void> | undefined
  let interruptStartup!: () => void
  const interrupted = new Promise<void>(resolve => { interruptStartup = resolve })

  async function runStart() {
    if (shuttingDown) return
    dependencies.validateEnvironment()
    dependencies.logger.info('Worker starting')
    await dependencies.preflight()
    if (shuttingDown) return
    worker = dependencies.startWorker()
    await Promise.race([worker.waitUntilReady?.(), interrupted])
    if (shuttingDown) return
    scheduler = dependencies.startScheduler()
    dependencies.onReady?.()
    dependencies.logger.info('Worker ready, listening for audit jobs')
  }
  function start() { return startPromise ??= runStart() }

  function shutdown(exitCode = 0): Promise<void> {
    if (stopPromise) return stopPromise
    shuttingDown = true
    interruptStartup()
    dependencies.onStopping?.()
    dependencies.logger.info('Worker stopping intake and draining active work')
    stopPromise = (async () => {
      const timeout = setTimeout(() => {
        dependencies.logger.error('Worker shutdown deadline exceeded; unfinished work is interrupted, not completed')
        dependencies.exit(1)
      }, dependencies.shutdownMs ?? shutdownDeadlineMs())
      // While queues drain, their normal idle heartbeat timer may already be closed.
      let heartbeatWrite: Promise<void> | undefined
      const stoppingHeartbeat = () => {
        if (!worker || heartbeatWrite) return heartbeatWrite
        heartbeatWrite = dependencies.beginShutdown?.()
          .catch(error => dependencies.logger.error('Stopping heartbeat failed', error))
          .finally(() => { heartbeatWrite = undefined })
        return heartbeatWrite
      }
      const heartbeat = setInterval(stoppingHeartbeat, 15_000)
      heartbeat.unref?.()
      try {
        await startPromise?.catch(() => {})
        const stoppingPublished = stoppingHeartbeat()
        // Calling close immediately stops consumer intake; scheduled callbacks then settle.
        const schedulerStopped = scheduler?.stop()
        const workerClosed = worker?.close()
        const settled = await Promise.allSettled([stoppingPublished, schedulerStopped, workerClosed])
        for (const result of settled) if (result.status === 'rejected') { exitCode = 1; dependencies.logger.error('Worker drain failed', result.reason) }
        await dependencies.closeBrowser().catch(error => { exitCode = 1; dependencies.logger.error('Browser cleanup failed', error) })
        clearInterval(heartbeat)
        await runBestEffort(dependencies.clearHeartbeat, { operation: 'worker_heartbeat_cleanup', logger: dependencies.logger, context: { exitCode } })
        await dependencies.releaseOwnership?.().catch(error => { exitCode = 1; dependencies.logger.error('Worker ownership cleanup failed', error) })
      } finally {
        clearInterval(heartbeat)
        clearTimeout(timeout)
      }
      dependencies.exit(exitCode)
    })()
    return stopPromise
  }
  return { start, shutdown, isShuttingDown: () => shuttingDown }
}
