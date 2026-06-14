import { prisma } from '@/lib/db'

/** Progress milestones aligned to pipeline stages (not per-check bumps). */
export const AUDIT_PROGRESS = {
  QUEUED: 5,
  CAPTURING: 20,
  CHECKING: 40,
  JUDGING: 70,
  FINALIZING: 90,
  COMPLETED: 100,
} as const

export async function setAuditProgress(auditId: string, progress: number): Promise<void> {
  await prisma.audit.update({
    where: { id: auditId },
    data: { progress: Math.min(100, Math.max(0, progress)) },
  })
}

export async function setAuditStage(
  auditId: string,
  status: 'QUEUED' | 'CAPTURING' | 'CHECKING' | 'JUDGING' | 'FINALIZING' | 'COMPLETED' | 'FAILED',
  progress?: number
): Promise<void> {
  const progressMap: Record<string, number> = {
    QUEUED: AUDIT_PROGRESS.QUEUED,
    CAPTURING: AUDIT_PROGRESS.CAPTURING,
    CHECKING: AUDIT_PROGRESS.CHECKING,
    JUDGING: AUDIT_PROGRESS.JUDGING,
    FINALIZING: AUDIT_PROGRESS.FINALIZING,
    COMPLETED: AUDIT_PROGRESS.COMPLETED,
    FAILED: 0,
  }
  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status,
      progress: progress ?? progressMap[status] ?? 0,
    },
  })
}
