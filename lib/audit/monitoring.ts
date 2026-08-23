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
  clientId?: string
  claimedAnonymous?: boolean
}

export function validateMonitoringParent(
  parent: { userId: string | null; status: string } | null,
  actor: { userId: string | null; claimedAnonymous?: boolean }
):
  | { ok: true }
  | { ok: false; status: number; error: string } {
  if (!parent) {
    return { ok: false, status: 404, error: 'Audit not found' }
  }
  const signedInOwner = Boolean(actor.userId) && parent.userId === actor.userId
  const anonymousOwner =
    parent.userId === null && Boolean(actor.claimedAnonymous)
  if (!signedInOwner && !anonymousOwner) {
    return { ok: false, status: 403, error: 'You can only re-check your own reports' }
  }
  if (parent.status !== 'COMPLETED') {
    return { ok: false, status: 400, error: 'You can only re-check completed reports' }
  }
  return { ok: true }
}

export async function startMonitoringAudit(
  parentId: string,
  user: User | null,
  options: StartMonitoringOptions = {}
): Promise<
  | { ok: true; result: MonitoringResult }
  | { ok: false; status: number; error: string; code?: string; action?: string }
> {
  const parent = await prisma.audit.findUnique({
    where: { id: parentId },
    select: { userId: true, status: true, url: true },
  })

  const validation = validateMonitoringParent(parent, {
    userId: user?.id ?? null,
    claimedAnonymous: Boolean(options.claimedAnonymous) && parent?.userId === null,
  })
  if (!validation.ok) {
    return validation
  }

  const trigger = options.trigger ?? 'MANUAL'
  const priorManualRecheck =
    !user || trigger === 'WATCH'
      ? 0
      : await prisma.audit.count({
          where: {
            userId: user.id,
            parentId: { not: null },
            url: parent!.url,
            OR: [{ recheckTrigger: null }, { recheckTrigger: 'MANUAL' }],
          },
        })
  const skipUsage = !user || trigger === 'WATCH' || priorManualRecheck === 0

  const { auditId, status, reused, parentId: parentAuditId } = await createAndEnqueueAudit({
    url: parent!.url,
    userId: user?.id ?? null,
    parentId,
    skipUsageCount: skipUsage,
    monitoringMode: 'FULL',
    recheckTrigger: options.trigger ?? 'MANUAL',
    delayMs: options.delayMs,
    clientId: options.clientId,
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
