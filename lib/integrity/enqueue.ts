import { getAuditQueue } from '@/lib/queue/client'
import { logger } from '@/lib/logger'

export async function enqueueIntegrityImprove(pathId: string): Promise<void> {
  try {
    await getAuditQueue().add(
      'integrity-improve',
      { pathId },
      { jobId: `integrity-improve-${pathId}-${Date.now()}` }
    )
  } catch (error) {
    logger.error('Failed to enqueue integrity Improve', {
      pathId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function enqueueIntegrityProbe(pathId: string, trigger = 'install'): Promise<void> {
  try {
    await getAuditQueue().add(
      'integrity-probe',
      { pathId, trigger },
      { jobId: `integrity-${pathId}-${trigger}-${Date.now()}` }
    )
  } catch (error) {
    logger.error('Failed to enqueue integrity probe', {
      pathId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
