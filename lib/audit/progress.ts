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
