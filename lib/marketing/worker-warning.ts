import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

export function getWorkerQueuedWarning(workerMissing = false): string {
  if (process.env.NODE_ENV === 'development') {
    return AUDIT_PROGRESS.workerQueuedWarningDev
  }
  if (workerMissing) {
    return AUDIT_PROGRESS.workerQueuedWarningProd
  }
  return AUDIT_PROGRESS.workerBacklogWarningProd
}
