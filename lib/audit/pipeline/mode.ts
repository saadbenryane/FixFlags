import { prisma } from '@/lib/db'

/**
 * Audit pipeline modes.
 *
 * Anonymous teaser scans (the first-value wedge) run the REDUCED pipeline so
 * first value lands in ~60-90s: capture + deterministic checks + PageSpeed on
 * the primary page only. Slow-3G replay and the browser flow walk are skipped
 * because together they add 30-60s of waiting that makes anonymous users
 * abandon. Signed-in users (new checks, re-checks, claimed audits) always get
 * the FULL pasted-page capture, including slow replay and the flow walk.
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
