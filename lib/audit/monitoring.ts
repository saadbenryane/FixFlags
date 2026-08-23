import { AuditStatus, RecheckTrigger, User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { buildAttribution } from '@/lib/leads/attribution'

export interface MonitoringResult {
  auditId: string
  status: AuditStatus
  reused: boolean
  parentAuditId: string | null
}

export interface StartMonitoringOptions {
  delayMs?: number
  trigger?: RecheckTrigger
}

export function validateMonitoringParent(
  parent: { userId: string | null; status: string } | null,
  userId: string
):
  | { ok: true }
  | { ok: false; status: number; error: string } {
  if (!parent) {
    return { ok: false, status: 404, error: 'Audit not found' }
  }
  if (parent.userId !== userId) {
    return { ok: false, status: 403, error: 'You can only re-check your own reports' }
  }
  if (parent.status !== 'COMPLETED') {
    return { ok: false, status: 400, error: 'You can only re-check completed reports' }
  }
  return { ok: true }
}

export async function startMonitoringAudit(
  parentId: string,
  user: User,
  options: StartMonitoringOptions = {}
): Promise<
  | { ok: true; result: MonitoringResult }
  | { ok: false; status: number; error: string; code?: string; action?: string }
> {
  const parent = await prisma.audit.findUnique({
    where: { id: parentId },
    select: { userId: true, status: true, url: true },
  })

  const validation = validateMonitoringParent(parent, user.id)
  if (!validation.ok) {
    return validation
  }

  const trigger = options.trigger ?? 'MANUAL'
  const priorManualRecheck =
    trigger === 'WATCH'
      ? 0
      : await prisma.audit.count({
          where: {
            userId: user.id,
            parentId: { not: null },
            url: parent!.url,
            OR: [{ recheckTrigger: null }, { recheckTrigger: 'MANUAL' }],
          },
        })
  // Watch-triggered runs skip the meter. First manual Recheck on this URL also skips.
  const skipUsage = trigger === 'WATCH' || priorManualRecheck === 0

  const { auditId, status, reused, parentId: parentAuditId } = await createAndEnqueueAudit({
    url: parent!.url,
    userId: user.id,
    parentId,
    skipUsageCount: skipUsage,
    monitoringMode: 'FULL',
    recheckTrigger: options.trigger ?? 'MANUAL',
    delayMs: options.delayMs,
    attribution: buildAttribution({
      url: parent!.url,
      source: 'DASHBOARD',
    }),
  })

  return {
    ok: true,
    result: { auditId, status, reused, parentAuditId },
  }
}
