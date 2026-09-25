import { prisma } from '@/lib/db'

/**
 * Audit pipeline modes.
 *
 * Anonymous teaser scans stay on one page and skip slow-3G replay so the
 * first check is shorter. They still walk that page. Signed-in users (new
 * checks, re-checks, claimed audits) also get slow replay and the same walk.
 * How far full judgment goes is `reviewDepth`, not a 6-URL crawler.
 */
export type AuditPipelineMode = 'FULL' | 'TEASER'

/** Anonymous teaser scans are new-URL audits created with no user and no parent. */
export function isTeaserAuditRow(row: {
  userId: string | null
  parentId: string | null
}): boolean {
  return row.userId === null && row.parentId === null
}

/**
 * Resolve the pipeline mode for an audit from its ownership row. Re-checks
 * (parentId set) and claimed or signed-in audits always resolve to FULL; only
 * an anonymous first scan with no parent resolves to TEASER.
 */
export async function resolveAuditPipelineMode(auditId: string): Promise<AuditPipelineMode> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { userId: true, parentId: true },
  })
  return audit && isTeaserAuditRow(audit) ? 'TEASER' : 'FULL'
}
