export interface WorkerHandle {
  close(): Promise<unknown>
}

export interface WorkerRuntimeLogger {
  info(message: string): void
  error(message: string, details?: unknown): void
}

export interface WorkerRuntimeDependencies {
  validateEnvironment(): void
  warmBrowser(): Promise<void>
  readBrowserDiagnostics(): {
    connected: boolean
    activeContexts: number
  }
  touchHeartbeat(update: {
    browserOk: boolean
    activeBrowserContexts: number
  }): Promise<void>
  clearHeartbeat(): Promise<void>
  startWorker(): WorkerHandle
  startScheduler(): void
  closeBrowser(): Promise<void>
  exit(code: number): void
  logger: WorkerRuntimeLogger
}

/**
 * Owns the standalone worker lifecycle without coupling tests to process-level
 * signal handlers. The web runtime never imports or calls this module.
 */
export function createWorkerRuntime(dependencies: WorkerRuntimeDependencies) {
  let worker: WorkerHandle | null = null
  let shuttingDown = false

  async function shutdown(exitCode = 0): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    dependencies.logger.info('Worker shutting down')
    await dependencies.clearHeartbeat().catch(() => {})
    await dependencies.closeBrowser()
    await worker?.close()
    dependencies.exit(exitCode)
  }

  async function start(): Promise<void> {
    dependencies.validateEnvironment()
    dependencies.logger.info('Worker starting')

    await dependencies.warmBrowser()
    const browser = dependencies.readBrowserDiagnostics()
    await dependencies.touchHeartbeat({
      browserOk: browser.connected,
      activeBrowserContexts: browser.activeContexts,
    })

    worker = dependencies.startWorker()
    dependencies.startScheduler()
    dependencies.logger.info('Worker ready, listening for audit jobs')
  }

  return {
    start,
    shutdown,
    isShuttingDown: () => shuttingDown,
  }
}
