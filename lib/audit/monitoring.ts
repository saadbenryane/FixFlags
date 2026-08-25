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
}

export function validateMonitoringParent(
  parent: { userId: string | null; status: string } | null,
  actor: { userId: string | null }
):
  | { ok: true }
  | { ok: false; status: number; error: string } {
  if (!parent) {
    return { ok: false, status: 404, error: 'Audit not found' }
  }
  const signedInOwner = Boolean(actor.userId) && parent.userId === actor.userId
  if (!actor.userId) {
    return { ok: false, status: 401, error: 'Sign in to run an update review' }
  }
  if (!signedInOwner) {
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

  const validation = validateMonitoringParent(parent, {
    userId: user.id,
  })
  if (!validation.ok) {
    return validation
  }

  const trigger = options.trigger ?? 'MANUAL'
  const skipUsage = trigger === 'WATCH'

  const { auditId, status, reused, parentId: parentAuditId } = await createAndEnqueueAudit({
    url: parent!.url,
    userId: user.id,
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
