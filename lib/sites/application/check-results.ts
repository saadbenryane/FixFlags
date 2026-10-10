import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { projectCheckResults } from '@/lib/sites/check-results'

/** Reads are bounded to the already authorized Site, never a shared hostname. */
export async function loadSiteCheckResults(site: SiteRecord, latestAuditId: string | null) {
  if (!latestAuditId) return []
  if (!site.projectId && !site.primaryAuditId) return []
  const auditWhere = site.projectId
    ? { projectId: site.projectId }
    : { id: site.primaryAuditId! }
  const receipts = await prisma.auditVerifierExecution.findMany({
    where: { targetKey: { startsWith: 'module:' }, audit: auditWhere,
      OR: [ { auditId: latestAuditId }, { status: 'COMPLETED', audit: { ...auditWhere, status: 'COMPLETED' } } ] },
    orderBy: { updatedAt: 'desc' },
    distinct: ['targetKey', 'scopeKey', 'status'],
    select: { id: true, auditId: true, targetKey: true, pageUrl: true, source: true, status: true, detail: true, updatedAt: true },
  })
  return receipts.flatMap(receipt => projectCheckResults(receipt.auditId, [receipt], receipt.auditId !== latestAuditId))
}
