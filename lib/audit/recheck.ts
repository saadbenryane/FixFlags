import { AuditStatus, User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import {
  canAccessPaidFeatures,
  canUseFreeRecheck,
  hasPendingTrialRecheck,
} from '@/lib/auth/entitlements'

export interface RecheckResult {
  auditId: string
  status: AuditStatus
  isTrialRecheck: boolean
}

export async function startRecheckAudit(
  parentId: string,
  user: User
): Promise<
  | { ok: true; result: RecheckResult }
  | { ok: false; status: number; error: string; code?: string; action?: string }
> {
  const parent = await prisma.audit.findUnique({ where: { id: parentId } })
  if (!parent) {
    return { ok: false, status: 404, error: 'Audit not found' }
  }

  if (parent.userId !== user.id) {
    return { ok: false, status: 403, error: 'You can only re-check your own audits' }
  }

  if (parent.status !== 'COMPLETED') {
    return { ok: false, status: 400, error: 'Can only re-check completed audits' }
  }

  const isPaid = canAccessPaidFeatures(user)
  const isTrialRecheck = !isPaid && canUseFreeRecheck(user)

  if (!isPaid && !isTrialRecheck) {
    if (await hasPendingTrialRecheck(user.id)) {
      return {
        ok: false,
        status: 402,
        error: 'A free re-check is already in progress',
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      }
    }
    return {
      ok: false,
      status: 402,
      error: 'Upgrade to Builder to use re-check',
      code: 'UPGRADE_REQUIRED',
      action: 'upgrade',
    }
  }

  if (isTrialRecheck && (await hasPendingTrialRecheck(user.id))) {
    return {
      ok: false,
      status: 402,
      error: 'A free re-check is already in progress',
      code: 'UPGRADE_REQUIRED',
      action: 'upgrade',
    }
  }

  try {
    const { auditId, status } = await createAndEnqueueAudit({
      url: parent.url,
      userId: user.id,
      parentId,
      skipUsageCount: isTrialRecheck || isPaid,
      trialRecheck: isTrialRecheck,
    })

    return {
      ok: true,
      result: { auditId, status, isTrialRecheck },
    }
  } catch (err) {
    throw err
  }
}
