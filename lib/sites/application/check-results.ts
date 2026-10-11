import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { projectCheckResults, type SiteCheckResult } from '@/lib/sites/check-results'

export const CHECK_RESULT_PAGE_SIZE = 100
const RECEIPT_BATCH_SIZE = 10
type ResultCursor = { version: 1; phase: 'current' | 'history'; receiptId: string | null; offset: number }
function encodeCursor(cursor: ResultCursor) { return Buffer.from(JSON.stringify(cursor)).toString('base64url') }
function decodeCursor(value?: string): ResultCursor {
  if (!value) return { version: 1, phase: 'current', receiptId: null, offset: 0 }
  if (value.length > 1024) throw new Error('Invalid check history cursor')
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as ResultCursor
    if (parsed.version !== 1 || !['current', 'history'].includes(parsed.phase) ||
      !(parsed.receiptId === null || typeof parsed.receiptId === 'string' && parsed.receiptId.length <= 160) ||
      !Number.isInteger(parsed.offset) || parsed.offset < 0 || parsed.offset > 600) throw new Error('invalid cursor')
    return parsed
  } catch {
    // Previously issued physical receipt cursors remain a history-only adapter.
    if (/^[a-zA-Z0-9_-]{1,160}$/.test(value) && !value.startsWith('ey')) return { version: 1, phase: 'history', receiptId: value, offset: 600 }
    throw new Error('Invalid check history cursor')
  }
}

/** Paginate observations, not merely receipts containing potentially hundreds of entities. */
export async function loadSiteCheckResultPage(site: SiteRecord, latestAuditId: string | null, rawCursor?: string) {
  if (!latestAuditId || (!site.projectId && !site.primaryAuditId)) return { results: [], nextCursor: null }
  const auditWhere = site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId! }
  const cursor = decodeCursor(rawCursor)
  if (cursor.receiptId) {
    const permitted = await prisma.auditVerifierExecution.findFirst({
      where: { id: cursor.receiptId, targetKey: { startsWith: 'module:' }, audit: auditWhere,
        auditId: cursor.phase === 'current' ? latestAuditId : { not: latestAuditId } },
      select: { id: true },
    })
    if (!permitted) throw new Error('Invalid check history cursor')
  }
  const receipts = await prisma.auditVerifierExecution.findMany({
    where: { targetKey: { startsWith: 'module:' }, audit: auditWhere,
      auditId: cursor.phase === 'current' ? latestAuditId : { not: latestAuditId } },
    orderBy: [{ audit: { createdAt: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
    take: RECEIPT_BATCH_SIZE + 1,
    ...(cursor.receiptId ? { cursor: { id: cursor.receiptId } } : {}),
    select: { id: true, auditId: true, targetKey: true, pageUrl: true, source: true, status: true, detail: true, updatedAt: true },
  })
  const results: SiteCheckResult[] = []
  for (let index = 0; index < Math.min(receipts.length, RECEIPT_BATCH_SIZE); index++) {
    const receipt = receipts[index]
    const projected = projectCheckResults(receipt.auditId, [receipt], cursor.phase === 'history')
    const offset = index === 0 && receipt.id === cursor.receiptId ? cursor.offset : 0
    const remaining = CHECK_RESULT_PAGE_SIZE - results.length
    results.push(...projected.slice(offset, offset + remaining))
    if (projected.length > offset + remaining) return { results, nextCursor: encodeCursor({
      version: 1, phase: cursor.phase, receiptId: receipt.id, offset: offset + remaining,
    }) }
    if (results.length === CHECK_RESULT_PAGE_SIZE && index < receipts.length - 1) return { results, nextCursor: encodeCursor({
      version: 1, phase: cursor.phase, receiptId: receipts[index + 1].id, offset: 0,
    }) }
  }
  if (receipts.length > RECEIPT_BATCH_SIZE) return { results, nextCursor: encodeCursor({
    version: 1, phase: cursor.phase, receiptId: receipts[RECEIPT_BATCH_SIZE].id, offset: 0,
  }) }
  if (cursor.phase === 'current') {
    const historical = await prisma.auditVerifierExecution.findFirst({
      where: { targetKey: { startsWith: 'module:' }, audit: auditWhere, auditId: { not: latestAuditId } }, select: { id: true },
    })
    if (historical) return { results, nextCursor: encodeCursor({ version: 1, phase: 'history', receiptId: null, offset: 0 }) }
  }
  return { results, nextCursor: null }
}

export async function loadSiteCheckResults(site: SiteRecord, latestAuditId: string | null) {
  return (await loadSiteCheckResultPage(site, latestAuditId)).results
}
