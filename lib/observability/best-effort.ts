export interface BestEffortLogger {
  warn(message: string, details: Record<string, unknown>): void
}

export interface BestEffortOptions {
  operation: string
  logger: BestEffortLogger
  context?: Record<string, unknown>
}

/**
 * Runs non-critical operational work without hiding failures.
 *
 * Callers deliberately continue after a failure, while the structured event
 * remains available to log-based metrics and incident diagnostics.
 */
export async function runBestEffort(
  task: () => Promise<unknown>,
  options: BestEffortOptions,
): Promise<boolean> {
  try {
    await task()
    return true
  } catch (error) {
    options.logger.warn('Best-effort operation failed', {
      operation: options.operation,
      outcome: 'failure',
      ...options.context,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
