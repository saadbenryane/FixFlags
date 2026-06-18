import { AuditStatus, User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { buildAttribution } from '@/lib/leads/attribution'

export interface RecheckResult {
  auditId: string
  status: AuditStatus
}

export interface StartRecheckOptions {
  delayMs?: number
}

export function validateRecheckParent(
  parent: { userId: string | null; status: string } | null,
  userId: string
):
  | { ok: true }
  | { ok: false; status: number; error: string } {
  if (!parent) {
    return { ok: false, status: 404, error: 'Audit not found' }
  }
  if (parent.userId !== userId) {
    return { ok: false, status: 403, error: 'You can only re-check your own audits' }
  }
  if (parent.status !== 'COMPLETED') {
    return { ok: false, status: 400, error: 'Can only re-check completed audits' }
  }
  return { ok: true }
}

export async function startRecheckAudit(
  parentId: string,
  user: User,
  options: StartRecheckOptions = {}
): Promise<
  | { ok: true; result: RecheckResult }
  | { ok: false; status: number; error: string; code?: string; action?: string }
> {
  const parent = await prisma.audit.findUnique({
    where: { id: parentId },
    select: { userId: true, status: true, url: true },
  })

  const validation = validateRecheckParent(parent, user.id)
  if (!validation.ok) {
    return validation
  }

  try {
    const { auditId, status } = await createAndEnqueueAudit({
      url: parent!.url,
      userId: user.id,
      parentId,
      skipUsageCount: true,
      recheckMode: 'SUMMARY_ONLY',
      delayMs: options.delayMs,
      attribution: buildAttribution({
        url: parent!.url,
        source: 'DASHBOARD',
      }),
    })

    return {
      ok: true,
      result: { auditId, status },
    }
  } catch (err) {
    throw err
  }
}
