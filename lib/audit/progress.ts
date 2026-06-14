import { prisma } from '@/lib/db'

/** Progress milestones (0–100) updated by the worker only. */
export const AUDIT_PROGRESS = {
  QUEUED: 5,
  CAPTURING: 12,
  DESKTOP_SCREENSHOT: 28,
  MOBILE_SCREENSHOT: 32,
  METADATA_FETCHED: 38,
  CHECKING_START: 42,
  CHECKING_STEP: 6,
  CHECKING_AREAS: 7,
  JUDGING: 85,
  COMPLETED: 100,
} as const

export async function setAuditProgress(auditId: string, progress: number): Promise<void> {
  await prisma.audit.update({
    where: { id: auditId },
    data: { progress: Math.min(100, Math.max(0, progress)) },
  })
}
