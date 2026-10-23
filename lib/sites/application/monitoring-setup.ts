import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const MONITORING_SETUP_RETRY_MS = 60_000
/** A URL that cannot be checked is not due every minute. Recheck it daily so a
 * corrected public URL can still receive a monitor. */
export const MONITORING_SETUP_UNAVAILABLE_RETRY_MS = 24 * 60 * 60 * 1000

export function monitoringSetupDue(now: Date): Prisma.ProjectWhereInput {
  return { OR: [{ monitoringSetupRetryAt: null }, { monitoringSetupRetryAt: { lte: now } }] }
}

/** Untouched Sites precede due retries; repeated failures cannot fill every batch. */
export const monitoringSetupOrder: Prisma.ProjectOrderByWithRelationInput[] = [
  { monitoringSetupRetryAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }, { id: 'asc' },
]

/** Callers retain the original owner, target and setup-state fence. This field
 * records operational retry only, independently of the owner's pause controls. */
export async function deferMonitoringSetup(where: Prisma.ProjectWhereInput, now: Date, delayMs = MONITORING_SETUP_RETRY_MS) {
  try {
    await prisma.project.updateMany({ where, data: { monitoringSetupRetryAt: new Date(now.getTime() + delayMs) } })
  } catch (error) {
    logger.error('Monitoring setup retry could not be recorded; independent Sites continue', error)
  }
}
