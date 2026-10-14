import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { projectCheckResults, type SiteCheckResult } from '@/lib/sites/check-results'
import { createHash } from 'node:crypto'
import { applicableCategoryEvidence, loadCategoryEvidence, type CategoryEvidenceAudit } from './category-evidence'
import type { CategoryArea } from '../domain/execution-spec'
import type { SiteCardArea } from '../card-areas'
import { CHECK_MODULES, CHECK_ASSERTIONS } from '@/lib/audit/check-registry'
import type { Prisma } from '@prisma/client'

export const CHECK_RESULT_PAGE_SIZE = 100
const RECEIPT_BATCH_SIZE = 10
type ResultCursor = { version: 1 | 2 | 3 | 4; phase: 'current' | 'history'; receiptId: string | null; offset: number; snapshot?: string; evidence?: string }
export type CheckResultFilter = { area?: SiteCardArea; pageUrl?: string }
function encodeCursor(cursor: ResultCursor) { return Buffer.from(JSON.stringify(cursor)).toString('base64url') }
function versionedScope(snapshot: string) { return createHash('sha256').update('recorded-results-v4:' + snapshot).digest('hex') }
function decodeCursor(value?: string): ResultCursor {
  if (!value) return { version: 1, phase: 'current', receiptId: null, offset: 0 }
  if (value.length > 1024) throw new Error('Invalid check history cursor')
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as ResultCursor
    if (![1, 2, 3, 4].includes(parsed.version) || parsed.version >= 2 && !/^[a-f0-9]{64}$/.test(parsed.snapshot ?? '') ||
      parsed.version === 4 && !/^[a-f0-9]{64}$/.test(parsed.evidence ?? '') ||
      !['current', 'history'].includes(parsed.phase) ||
      !(parsed.receiptId === null || typeof parsed.receiptId === 'string' && parsed.receiptId.length <= 160) ||
      !Number.isInteger(parsed.offset) || parsed.offset < 0 || parsed.offset > 600) throw new Error('invalid cursor')
    return parsed
  } catch {
    // Previously issued physical receipt cursors remain a history-only adapter.
    if (/^[a-zA-Z0-9_-]{1,160}$/.test(value) && !value.startsWith('ey')) return { version: 1, phase: 'history', receiptId: value, offset: 600 }
    throw new Error('Invalid check history cursor')
  }
}

type ResultDatabase = Pick<Prisma.TransactionClient, 'auditVerifierExecution'>
type Receipt = Parameters<typeof projectCheckResults>[1][number] & { auditId: string }
function scopedReceiptResults(receipt: Receipt, phase: ResultCursor['phase'], latestAuditId: string,
  categories: Map<CategoryArea, CategoryEvidenceAudit>, filter: CheckResultFilter) {
  return projectCheckResults(receipt.auditId, [receipt]).filter(result => {
    const currentId = categories.get(result.area as CategoryArea)?.id ?? latestAuditId
    return (!filter.area || result.area === filter.area) && (!filter.pageUrl || result.pageUrl === filter.pageUrl) &&
      (phase === 'current' ? result.auditId === currentId : result.auditId !== currentId)
  }).map(result => phase === 'history' ? { ...result, historical: true } : result)
}
function resultModules(filter: CheckResultFilter) {
  return filter.area ? Object.entries(CHECK_MODULES).filter(([name, descriptor]) => descriptor.area === filter.area ||
    Object.values(CHECK_ASSERTIONS[name] ?? {}).some(assertion => assertion.area === filter.area)).map(([name]) => `module:${name}`) : null
}

/** Count the same scoped observations in bounded batches, without retaining
 * whole history documents or treating a physical receipt as one result. */
async function scopedResultTotal(database: ResultDatabase, site: SiteRecord, latestAuditId: string,
  categories: Map<CategoryArea, CategoryEvidenceAudit>, filter: CheckResultFilter, next: ResultCursor | null) {
  const categoriesIds = [...categories.values()].map(audit => audit.id)
  const modules = resultModules(filter)
  const evidence = createHash('sha256')
  let total = 0, remaining = 0
  for (const phase of ['current', 'history'] as const) {
    let after: string | undefined
    let beyond = next?.phase === phase && next.receiptId === null || next?.phase === 'current' && phase === 'history'
    for (;;) {
      const receipts = await database.auditVerifierExecution.findMany({
        where: { audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId! },
          targetKey: modules ? { in: modules } : { startsWith: 'module:' },
          auditId: phase === 'current' ? { in: [latestAuditId, ...categoriesIds] }
            : categoriesIds.length ? { notIn: categoriesIds } : { not: latestAuditId },
          ...(filter.pageUrl ? { pageUrl: filter.pageUrl } : {}) },
        orderBy: [{ audit: { createdAt: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }], take: RECEIPT_BATCH_SIZE,
        ...(after ? { cursor: { id: after }, skip: 1 } : {}),
        select: { id: true, auditId: true, targetKey: true, pageUrl: true, source: true, status: true, detail: true, updatedAt: true },
      })
      for (const receipt of receipts) {
        evidence.update(JSON.stringify([phase, receipt.id, receipt.auditId, receipt.targetKey, receipt.pageUrl,
          receipt.source, receipt.status, receipt.updatedAt.toISOString(), receipt.detail]))
        const size = scopedReceiptResults(receipt, phase, latestAuditId, categories, filter).length
        total += size
        if (next?.phase === phase && receipt.id === next.receiptId) {
          beyond = true; remaining += Math.max(0, size - next.offset)
        } else if (beyond) remaining += size
      }
      if (receipts.length < RECEIPT_BATCH_SIZE) break
      after = receipts.at(-1)!.id
    }
  }
  return { total, remaining, evidence: evidence.digest('hex') }
}

export async function loadSiteCheckResultPage(site: SiteRecord,
  latestAudit: string | { id: string; status: string; createdAt: Date } | null, rawCursor?: string,
  categoryEvidence?: Map<CategoryArea, CategoryEvidenceAudit>, filter: CheckResultFilter = {}, includeTotal = false) {
  const id = typeof latestAudit === 'string' ? latestAudit : latestAudit?.id
  const needsSnapshot = includeTotal || Boolean(rawCursor && decodeCursor(rawCursor).version === 4)
  if (!needsSnapshot || !id || !site.projectId && !site.primaryAuditId)
    return readSiteCheckResultPage(prisma, site, latestAudit, rawCursor, categoryEvidence, filter)
  const categories = categoryEvidence ?? (typeof latestAudit === 'object' && latestAudit
    ? applicableCategoryEvidence(await loadCategoryEvidence(site.projectId ? [site.projectId] : []), latestAudit) : new Map<CategoryArea, CategoryEvidenceAudit>())
  // The visible page and its total belong to one database snapshot, including
  // a run that is still recording observations. Count is not coverage or health.
  return prisma.$transaction(async tx => {
    const page = await readSiteCheckResultPage(tx, site, latestAudit, rawCursor, categories, filter)
    const next = page.nextCursor ? decodeCursor(page.nextCursor) : null
    const counted = await scopedResultTotal(tx, site, id, categories, filter, next)
    const previous = decodeCursor(rawCursor)
    if (previous.version === 4 && previous.evidence !== counted.evidence) throw new Error('Check evidence selection changed')
    return { ...page, total: counted.total, nextCursor: next && counted.remaining > 0
      ? encodeCursor({ ...next, version: 4, snapshot: versionedScope(next.snapshot!), evidence: counted.evidence }) : null }
  }, { isolationLevel: 'RepeatableRead', timeout: 15_000 })
}

/** Paginate observations, not merely receipts containing potentially hundreds of entities. */
async function readSiteCheckResultPage(database: ResultDatabase, site: SiteRecord,
  latestAudit: string | { id: string; status: string; createdAt: Date } | null, rawCursor?: string,
  categoryEvidence?: Map<CategoryArea, CategoryEvidenceAudit>, filter: CheckResultFilter = {}) {
  const latestAuditId = typeof latestAudit === 'string' ? latestAudit : latestAudit?.id ?? null
  if (!latestAuditId || (!site.projectId && !site.primaryAuditId)) return { results: [], nextCursor: null, total: 0 }
  const categories = categoryEvidence ?? (typeof latestAudit === 'object' && latestAudit
    ? applicableCategoryEvidence(await loadCategoryEvidence(site.projectId ? [site.projectId] : []), latestAudit) : new Map<CategoryArea, CategoryEvidenceAudit>())
  const categoryIds = [...categories.values()].map(audit => audit.id)
  const currentIds = [latestAuditId, ...categoryIds]
  const snapshot = createHash('sha256').update(JSON.stringify([site.siteId ?? site.projectId ?? site.primaryAuditId, latestAuditId, filter.area ?? null, filter.pageUrl ?? null,
    [...categories].map(([area, audit]) => [area, audit.id]).sort(([a], [b]) => a.localeCompare(b))])).digest('hex')
  const auditWhere = site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId! }
  const cursor = decodeCursor(rawCursor)
  const legacySnapshot = createHash('sha256').update(JSON.stringify([latestAuditId,
    [...categories].map(([area, audit]) => [area, audit.id]).sort(([a], [b]) => a.localeCompare(b))])).digest('hex')
  if (rawCursor && (cursor.version === 4 && cursor.snapshot !== versionedScope(snapshot) || cursor.version === 3 && cursor.snapshot !== snapshot || cursor.version === 2 && cursor.snapshot !== legacySnapshot ||
    cursor.version < 3 && (filter.area || filter.pageUrl))) throw new Error('Invalid check history cursor')
  const currentWhere = { in: currentIds }
  const historyWhere = categories.size ? { notIn: categoryIds } : { not: latestAuditId }
  const encodeNext = (phase: ResultCursor['phase'], receiptId: string | null, offset: number) =>
    encodeCursor({ version: 3, phase, receiptId, offset, snapshot })
  if (cursor.receiptId) {
    const permitted = await database.auditVerifierExecution.findFirst({
      where: { id: cursor.receiptId, targetKey: { startsWith: 'module:' }, audit: auditWhere,
        auditId: cursor.phase === 'current' ? currentWhere : historyWhere },
      select: { id: true },
    })
    if (!permitted) throw new Error('Invalid check history cursor')
  }
  const results: SiteCheckResult[] = []
  const modules = resultModules(filter)
  let phase = cursor.phase, receiptId = cursor.receiptId, receiptOffset = cursor.offset
  // Scope is applied before pagination. Bounded physical reads may return a
  // continuation, but never mislabel unrelated observations as category results.
  for (let batch = 0; batch < (filter.area || filter.pageUrl ? 100 : 1); batch++) {
    const receipts = await database.auditVerifierExecution.findMany({
      where: { targetKey: modules ? { in: modules } : { startsWith: 'module:' }, audit: auditWhere,
        ...(filter.pageUrl ? { pageUrl: filter.pageUrl } : {}),
        auditId: phase === 'current' ? currentWhere : historyWhere },
      orderBy: [{ audit: { createdAt: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
      take: RECEIPT_BATCH_SIZE + 1,
      ...(receiptId ? { cursor: { id: receiptId } } : {}),
      select: { id: true, auditId: true, targetKey: true, pageUrl: true, source: true, status: true, detail: true, updatedAt: true },
    })
    for (let index = 0; index < Math.min(receipts.length, RECEIPT_BATCH_SIZE); index++) {
    const receipt = receipts[index]
    const projected = scopedReceiptResults(receipt, phase, latestAuditId, categories, filter)
    const offset = index === 0 && receipt.id === receiptId ? receiptOffset : 0
    const remaining = CHECK_RESULT_PAGE_SIZE - results.length
    results.push(...projected.slice(offset, offset + remaining))
    if (projected.length > offset + remaining) return { results, nextCursor: encodeNext(phase, receipt.id, offset + remaining), total: null }
    if (results.length === CHECK_RESULT_PAGE_SIZE && index < receipts.length - 1)
      return { results, nextCursor: encodeNext(phase, receipts[index + 1].id, 0), total: null }
    }
    if (receipts.length > RECEIPT_BATCH_SIZE) {
      receiptId = receipts[RECEIPT_BATCH_SIZE].id; receiptOffset = 0
      if (results.length === CHECK_RESULT_PAGE_SIZE || batch === (filter.area || filter.pageUrl ? 99 : 0))
        return { results, nextCursor: encodeNext(phase, receiptId, 0), total: null }
      continue
    }
    if (phase === 'current') {
    const historical = await database.auditVerifierExecution.findFirst({
      where: { targetKey: modules ? { in: modules } : { startsWith: 'module:' }, audit: auditWhere, auditId: historyWhere,
        ...(filter.pageUrl ? { pageUrl: filter.pageUrl } : {}) }, select: { id: true },
    })
      if (historical) {
        if ((filter.area || filter.pageUrl) && !results.length) { phase = 'history'; receiptId = null; receiptOffset = 0; continue }
        return { results, nextCursor: encodeNext('history', null, 0), total: null }
      }
    }
    // A resumed cursor cannot supply a trustworthy cumulative count. Only a
    // completely inspected first page establishes an exact scope total.
    return { results, nextCursor: null, total: !rawCursor ? results.length : null }
  }
  return { results, nextCursor: encodeNext(phase, receiptId, receiptOffset), total: null }
}

export async function loadSiteCheckResults(site: SiteRecord, latestAuditId: string | null) {
  return (await loadSiteCheckResultPage(site, latestAuditId)).results
}
