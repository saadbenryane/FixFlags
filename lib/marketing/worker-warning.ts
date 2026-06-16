import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

export function getWorkerQueuedWarning(): string {
  if (process.env.NODE_ENV === 'development') {
    return AUDIT_PROGRESS.workerQueuedWarningDev
  }
  return AUDIT_PROGRESS.workerQueuedWarningProd
}
