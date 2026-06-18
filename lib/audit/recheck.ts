import { AuditStatus, User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { buildAttribution } from '@/lib/leads/attribution'

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

  try {
    const { auditId, status } = await createAndEnqueueAudit({
      url: parent.url,
      userId: user.id,
      parentId,
      skipUsageCount: true,
      trialRecheck: false,
      recheckMode: 'SUMMARY_ONLY',
      attribution: buildAttribution({
        url: parent.url,
        source: 'DASHBOARD',
      }),
    })

    return {
      ok: true,
      result: { auditId, status, isTrialRecheck: false },
    }
  } catch (err) {
    throw err
  }
}
