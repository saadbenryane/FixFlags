import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { projectCheckResults, type SiteCheckResult } from '@/lib/sites/check-results'
import { createHash } from 'node:crypto'
import { applicableCategoryEvidence, loadCategoryEvidence, type CategoryEvidenceAudit } from './category-evidence'
import type { CategoryArea } from '../domain/execution-spec'

export const CHECK_RESULT_PAGE_SIZE = 100
const RECEIPT_BATCH_SIZE = 10
type ResultCursor = { version: 1 | 2; phase: 'current' | 'history'; receiptId: string | null; offset: number; snapshot?: string }
function encodeCursor(cursor: ResultCursor) { return Buffer.from(JSON.stringify(cursor)).toString('base64url') }
function decodeCursor(value?: string): ResultCursor {
  if (!value) return { version: 1, phase: 'current', receiptId: null, offset: 0 }
  if (value.length > 1024) throw new Error('Invalid check history cursor')
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as ResultCursor
    if (![1, 2].includes(parsed.version) || parsed.version === 2 && !/^[a-f0-9]{64}$/.test(parsed.snapshot ?? '') || !['current', 'history'].includes(parsed.phase) ||
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
export async function loadSiteCheckResultPage(site: SiteRecord,
  latestAudit: string | { id: string; status: string; createdAt: Date } | null, rawCursor?: string,
  categoryEvidence?: Map<CategoryArea, CategoryEvidenceAudit>) {
  const latestAuditId = typeof latestAudit === 'string' ? latestAudit : latestAudit?.id ?? null
  if (!latestAuditId || (!site.projectId && !site.primaryAuditId)) return { results: [], nextCursor: null }
  const categories = categoryEvidence ?? (typeof latestAudit === 'object' && latestAudit
    ? applicableCategoryEvidence(await loadCategoryEvidence(site.projectId ? [site.projectId] : []), latestAudit) : new Map<CategoryArea, CategoryEvidenceAudit>())
  const categoryIds = [...categories.values()].map(audit => audit.id)
  const currentIds = [latestAuditId, ...categoryIds]
  const snapshot = createHash('sha256').update(JSON.stringify([latestAuditId,
    [...categories].map(([area, audit]) => [area, audit.id]).sort(([a], [b]) => a.localeCompare(b))])).digest('hex')
  const auditWhere = site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId! }
  const cursor = decodeCursor(rawCursor)
  if (cursor.version === 2 && cursor.snapshot !== snapshot) throw new Error('Invalid check history cursor')
  const currentWhere = { in: currentIds }
  const historyWhere = categories.size ? { notIn: categoryIds } : { not: latestAuditId }
  const encodeNext = (phase: ResultCursor['phase'], receiptId: string | null, offset: number) =>
    encodeCursor({ version: 2, phase, receiptId, offset, snapshot })
  if (cursor.receiptId) {
    const permitted = await prisma.auditVerifierExecution.findFirst({
      where: { id: cursor.receiptId, targetKey: { startsWith: 'module:' }, audit: auditWhere,
        auditId: cursor.phase === 'current' ? currentWhere : historyWhere },
      select: { id: true },
    })
    if (!permitted) throw new Error('Invalid check history cursor')
  }
  const receipts = await prisma.auditVerifierExecution.findMany({
    where: { targetKey: { startsWith: 'module:' }, audit: auditWhere,
      auditId: cursor.phase === 'current' ? currentWhere : historyWhere },
    orderBy: [{ audit: { createdAt: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
    take: RECEIPT_BATCH_SIZE + 1,
    ...(cursor.receiptId ? { cursor: { id: cursor.receiptId } } : {}),
    select: { id: true, auditId: true, targetKey: true, pageUrl: true, source: true, status: true, detail: true, updatedAt: true },
  })
  const results: SiteCheckResult[] = []
  for (let index = 0; index < Math.min(receipts.length, RECEIPT_BATCH_SIZE); index++) {
    const receipt = receipts[index]
    const projected = projectCheckResults(receipt.auditId, [receipt]).filter(result => {
      const currentId = categories.get(result.area as CategoryArea)?.id ?? latestAuditId
      return cursor.phase === 'current' ? result.auditId === currentId : result.auditId !== currentId
    }).map(result => cursor.phase === 'history' ? { ...result, historical: true } : result)
    const offset = index === 0 && receipt.id === cursor.receiptId ? cursor.offset : 0
    const remaining = CHECK_RESULT_PAGE_SIZE - results.length
    results.push(...projected.slice(offset, offset + remaining))
    if (projected.length > offset + remaining) return { results, nextCursor: encodeNext(cursor.phase, receipt.id, offset + remaining) }
    if (results.length === CHECK_RESULT_PAGE_SIZE && index < receipts.length - 1)
      return { results, nextCursor: encodeNext(cursor.phase, receipts[index + 1].id, 0) }
  }
  if (receipts.length > RECEIPT_BATCH_SIZE) return { results, nextCursor: encodeNext(cursor.phase, receipts[RECEIPT_BATCH_SIZE].id, 0) }
  if (cursor.phase === 'current') {
    const historical = await prisma.auditVerifierExecution.findFirst({
      where: { targetKey: { startsWith: 'module:' }, audit: auditWhere, auditId: historyWhere }, select: { id: true },
    })
    if (historical) return { results, nextCursor: encodeNext('history', null, 0) }
  }
  return { results, nextCursor: null }
}

export async function loadSiteCheckResults(site: SiteRecord, latestAuditId: string | null) {
  return (await loadSiteCheckResultPage(site, latestAuditId)).results
}
