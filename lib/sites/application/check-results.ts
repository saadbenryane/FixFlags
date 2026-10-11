import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { projectCheckResults } from '@/lib/sites/check-results'

export const CHECK_RESULT_PAGE_SIZE = 100

/** Reads are bounded to the already authorized Site, never a shared hostname. */
export async function loadSiteCheckResultPage(site: SiteRecord, latestAuditId: string | null, cursor?: string) {
  if (!latestAuditId || (!site.projectId && !site.primaryAuditId)) return { results: [], nextCursor: null }
  const auditWhere = site.projectId
    ? { projectId: site.projectId }
    : { id: site.primaryAuditId! }
  if (cursor) {
    const permitted = await prisma.auditVerifierExecution.findFirst({
      where: { id: cursor, targetKey: { startsWith: 'module:' }, audit: auditWhere }, select: { id: true },
    })
    if (!permitted) throw new Error('Invalid check history cursor')
  }
  const receipts = await prisma.auditVerifierExecution.findMany({
    where: { targetKey: { startsWith: 'module:' }, audit: auditWhere },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: CHECK_RESULT_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, auditId: true, targetKey: true, pageUrl: true, source: true, status: true, detail: true, updatedAt: true },
  })
  const page = receipts.slice(0, CHECK_RESULT_PAGE_SIZE)
  return {
    results: page.flatMap(receipt => projectCheckResults(receipt.auditId, [receipt], receipt.auditId !== latestAuditId)),
    nextCursor: receipts.length > CHECK_RESULT_PAGE_SIZE ? page.at(-1)!.id : null,
  }
}

export async function loadSiteCheckResults(site: SiteRecord, latestAuditId: string | null) {
  return (await loadSiteCheckResultPage(site, latestAuditId)).results
}
