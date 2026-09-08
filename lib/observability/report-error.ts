import { logger } from '@/lib/logger'

export function reportOperationalError(
  operation: string,
  error: unknown,
  context: Record<string, unknown> = {}
): void {
  logger.error('operational_error', {
    operation,
    outcome: 'failure',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  })
}
