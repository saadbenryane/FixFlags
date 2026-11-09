import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { projectCheckResults, SEARCH_RESULT_TARGET_KEYS } from '@/lib/sites/check-results'
import { CheckResultSelectionChanged, type SiteCheckResult } from '@/lib/sites/check-result-contract'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { applicableCategoryEvidence, loadCategoryEvidence, type CategoryEvidenceAudit } from './category-evidence'
import type { CategoryArea } from '../domain/execution-spec'
import type { SiteCardArea } from '../card-areas'
import { CHECK_MODULES, checkModuleHasAssertionsInArea, REASSIGNED_CHECK_ASSERTION_AREAS } from '@/lib/audit/checks/definitions'
import { Prisma } from '@prisma/client'
import { readSiteEvidence } from './site-evidence-read'

export const CHECK_RESULT_PAGE_SIZE = 100
const RECEIPT_BATCH_SIZE = 10
const COUNT_RECEIPT_BATCH_SIZE = 100
const COUNT_RECEIPT_BYTES = 1024 * 1024
type ResultPosition = { phase: 'current' | 'history'; receiptId: string | null; offset: number }
type SnapshotCursor = ResultPosition & { version: 5; snapshot: string; evidence: string;
  total: number; remaining: number; signature: string }
type ResultCursor = ResultPosition & { version: 1 | 2 | 3 | 4; snapshot?: string; evidence?: string } | SnapshotCursor
export type CheckResultFilter = { area?: SiteCardArea; pageUrl?: string }
function encodeCursor(cursor: ResultCursor) { return Buffer.from(JSON.stringify(cursor)).toString('base64url') }
function versionedScope(snapshot: string, version: 4 | 5) {
  return createHash('sha256').update(`recorded-results-v${version}:` + snapshot).digest('hex')
}
function signSnapshotCursor(cursor: Omit<SnapshotCursor, 'signature'>, key: string) {
  return createHmac('sha256', key).update('fixflags-check-history-v5:').update(JSON.stringify([
    cursor.phase, cursor.receiptId, cursor.offset, cursor.snapshot, cursor.evidence, cursor.total, cursor.remaining,
  ])).digest()
}
function decodeCursor(value?: string): ResultCursor {
  if (!value) return { version: 1, phase: 'current', receiptId: null, offset: 0 }
  if (value.length > 1024) throw new CheckResultSelectionChanged()
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as ResultCursor
    if (![1, 2, 3, 4, 5].includes(parsed.version) || parsed.version >= 2 && !/^[a-f0-9]{64}$/.test(parsed.snapshot ?? '') ||
      parsed.version >= 4 && !/^[a-f0-9]{64}$/.test(parsed.evidence ?? '') ||
      !['current', 'history'].includes(parsed.phase) ||
      !(parsed.receiptId === null || typeof parsed.receiptId === 'string' && parsed.receiptId.length <= 160) ||
      !Number.isInteger(parsed.offset) || parsed.offset < 0 || parsed.offset > 600) throw new Error('invalid cursor')
    if (parsed.version === 5) {
      const key = process.env.BETTER_AUTH_SECRET
      if (!key ||
        !Number.isSafeInteger(parsed.total) || !Number.isSafeInteger(parsed.remaining) || parsed.remaining <= 0 || parsed.remaining > parsed.total ||
        typeof parsed.signature !== 'string' || !/^[a-f0-9]{64}$/.test(parsed.signature) ||
        !timingSafeEqual(signSnapshotCursor(parsed, key), Buffer.from(parsed.signature, 'hex'))) throw new Error('invalid cursor')
    }
    return parsed
  } catch {
    // Previously issued physical receipt cursors remain a history-only adapter.
    if (/^[a-zA-Z0-9_-]{1,160}$/.test(value) && !value.startsWith('ey')) return { version: 1, phase: 'history', receiptId: value, offset: 600 }
    throw new CheckResultSelectionChanged()
  }
}

type ResultDatabase = Pick<Prisma.TransactionClient, 'auditVerifierExecution' | '$queryRaw'>
type Receipt = Parameters<typeof projectCheckResults>[1][number] & { auditId: string }

function receiptSelection(site: SiteRecord, filter: CheckResultFilter) {
  const modules = resultModules(filter)
  const targets = modules ? modules.length ? Prisma.sql`r."targetKey" IN (${Prisma.join(modules)})` : Prisma.sql`FALSE`
    : Prisma.sql`r."targetKey" LIKE 'module:%'`
  return Prisma.sql`${site.projectId ? Prisma.sql`a."projectId" = ${site.projectId}` : Prisma.sql`a.id = ${site.primaryAuditId!}`}
    AND ${targets} ${filter.pageUrl ? Prisma.sql`AND r."pageUrl" = ${filter.pageUrl}` : Prisma.empty}`
}

/** Check the actual receipt contents and order without sending historical
 * payloads back to the application. Each row contributes a fixed-size hash. */
async function readReceiptFingerprint(database: ResultDatabase, site: SiteRecord, filter: CheckResultFilter) {
  const [snapshot] = await database.$queryRaw<Array<{ evidence: string }>>(Prisma.sql`
    SELECT encode(sha256(convert_to(COALESCE(string_agg(
      encode(sha256(convert_to(jsonb_build_array(r.id, r."auditId", r."targetKey", r."pageUrl", r.source, r.status,
        r."updatedAt", a."createdAt", r."createdAt", r.detail, r."taskId")::text, 'UTF8')), 'hex'),
      '' ORDER BY a."createdAt" DESC, r."createdAt" DESC, r.id DESC), ''), 'UTF8')), 'hex') AS evidence
    FROM "audit_verifier_executions" r JOIN audits a ON a.id = r."auditId"
    WHERE ${receiptSelection(site, filter)}`)
  return snapshot.evidence
}

/** Count reads amortize round trips while bounding transferred detail. One
 * oversized receipt must still be inspected on its own to preserve exact totals. */
async function countReceiptBatch(database: ResultDatabase, site: SiteRecord, latestAuditId: string,
  categoryIds: string[], filter: CheckResultFilter, phase: ResultCursor['phase'], after?: string) {
  const auditIds = [latestAuditId, ...categoryIds]
  const selection = phase === 'current' ? Prisma.sql`a.id IN (${Prisma.join(auditIds)})`
    : categoryIds.length ? Prisma.sql`TRUE` : Prisma.sql`a.id <> ${latestAuditId}`
  return database.$queryRaw<Receipt[]>(Prisma.sql`
    WITH candidates AS MATERIALIZED (
      SELECT r.id, r."auditId", r."targetKey", r."pageUrl", r.source, r.status,
        r.detail, r."taskId", r."updatedAt", r."createdAt", a."createdAt" AS "auditCreatedAt"
      FROM "audit_verifier_executions" r JOIN audits a ON a.id = r."auditId"
      WHERE ${receiptSelection(site, filter)}
        AND ${selection}
        ${after ? Prisma.sql`AND (a."createdAt", r."createdAt", r.id) < (
          SELECT cursor_audit."createdAt", cursor_row."createdAt", cursor_row.id
          FROM "audit_verifier_executions" cursor_row JOIN audits cursor_audit ON cursor_audit.id = cursor_row."auditId"
          WHERE cursor_row.id = ${after})` : Prisma.empty}
      ORDER BY a."createdAt" DESC, r."createdAt" DESC, r.id DESC LIMIT ${COUNT_RECEIPT_BATCH_SIZE}
    ), bounded AS (
      SELECT *, ROW_NUMBER() OVER ordering AS position,
        SUM(COALESCE(octet_length(detail::text), 0)) OVER ordering AS bytes
      FROM candidates WINDOW ordering AS (ORDER BY "auditCreatedAt" DESC, "createdAt" DESC, id DESC)
    )
    SELECT id, "auditId", "targetKey", "pageUrl", source, status, detail, "taskId", "updatedAt"
    FROM bounded WHERE bytes <= ${COUNT_RECEIPT_BYTES} OR position = 1
    ORDER BY "auditCreatedAt" DESC, "createdAt" DESC, id DESC`)
}
function scopedReceiptResults(receipt: Receipt, phase: ResultCursor['phase'], latestAuditId: string,
  categories: Map<CategoryArea, CategoryEvidenceAudit>, filter: CheckResultFilter) {
  return projectCheckResults(receipt.auditId, [receipt]).filter(result => {
    const currentId = categories.get(result.area as CategoryArea)?.id ?? latestAuditId
    return (!filter.area || result.area === filter.area) && (!filter.pageUrl || result.pageUrl === filter.pageUrl) &&
      (phase === 'current' ? result.auditId === currentId : result.auditId !== currentId)
  }).map(result => phase === 'history' ? { ...result, historical: true } : result)
}
function resultModules(filter: CheckResultFilter) {
  const { area } = filter
  if (!area) return null
  const modules = Object.entries(CHECK_MODULES).filter(([name, descriptor]) => descriptor.area === area ||
    checkModuleHasAssertionsInArea(name, area)).map(([name]) => `module:${name}`)
  return area === 'search' ? [...new Set([...modules, ...SEARCH_RESULT_TARGET_KEYS])] : modules
}

/** Count the same scoped observations in bounded batches, without retaining
 * whole history documents or treating a physical receipt as one result. */
async function scopedResultTotal(database: ResultDatabase, site: SiteRecord, latestAuditId: string,
  categories: Map<CategoryArea, CategoryEvidenceAudit>, filter: CheckResultFilter, next: ResultCursor | null, fingerprint: boolean) {
  const categoriesIds = [...categories.values()].map(audit => audit.id)
  const evidence = createHash('sha256')
  let total = 0, remaining = 0
  for (const phase of ['current', 'history'] as const) {
    let after: string | undefined
    let beyond = next?.phase === phase && next.receiptId === null || next?.phase === 'current' && phase === 'history'
    for (;;) {
      const receipts = await countReceiptBatch(database, site, latestAuditId, categoriesIds, filter, phase, after)
      if (!receipts.length) break
      for (const receipt of receipts) {
        if (fingerprint) evidence.update(JSON.stringify([phase, receipt.id, receipt.auditId, receipt.targetKey, receipt.pageUrl,
          receipt.source, receipt.status, receipt.updatedAt.toISOString(), receipt.detail, receipt.taskId]))
        const size = scopedReceiptResults(receipt, phase, latestAuditId, categories, filter).length
        total += size
        if (next?.phase === phase && receipt.id === next.receiptId) {
          beyond = true; remaining += Math.max(0, size - next.offset)
        } else if (beyond) remaining += size
      }
      after = receipts.at(-1)!.id
    }
  }
  return { total, remaining, evidence: evidence.digest('hex') }
}

export async function loadSiteCheckResultPage(site: SiteRecord,
  latestAudit: string | { id: string; status: string; createdAt: Date } | null, rawCursor?: string,
  categoryEvidence?: Map<CategoryArea, CategoryEvidenceAudit>, filter: CheckResultFilter = {}, includeTotal = false) {
  return readSiteEvidence(site, () => collectSiteCheckResultPage(site, latestAudit, rawCursor, categoryEvidence, filter, includeTotal))
}

async function collectSiteCheckResultPage(site: SiteRecord,
  latestAudit: string | { id: string; status: string; createdAt: Date } | null, rawCursor: string | undefined,
  categoryEvidence: Map<CategoryArea, CategoryEvidenceAudit> | undefined, filter: CheckResultFilter, includeTotal: boolean) {
  const id = typeof latestAudit === 'string' ? latestAudit : latestAudit?.id
  const previous = decodeCursor(rawCursor)
  const needsSnapshot = includeTotal || previous.version >= 4
  if (!needsSnapshot || !id || !site.projectId && !site.primaryAuditId)
    return readSiteCheckResultPage(prisma, site, latestAudit, rawCursor, categoryEvidence, filter)
  const categories = categoryEvidence ?? (typeof latestAudit === 'object' && latestAudit
    ? applicableCategoryEvidence(await loadCategoryEvidence(site.projectId ? [{ projectId: site.projectId, auditId: latestAudit.id }] : []), latestAudit) : new Map<CategoryArea, CategoryEvidenceAudit>())
  // The visible page and its total belong to one database snapshot, including
  // a run that is still recording observations. Count is not coverage or health.
  return prisma.$transaction(async tx => {
    const page = await readSiteCheckResultPage(tx, site, latestAudit, rawCursor, categories, filter)
    const next = page.nextCursor ? decodeCursor(page.nextCursor) : null
    const key = process.env.BETTER_AUTH_SECRET
    const counted = previous.version === 5
      ? { total: previous.total, remaining: previous.remaining - page.results.length, evidence: previous.evidence }
      : await scopedResultTotal(tx, site, id, categories, filter, next, !key || previous.version === 4)
    if (previous.version === 4 && previous.evidence !== counted.evidence) throw new CheckResultSelectionChanged('evidence')
    const hasMore = next && counted.remaining > 0
    const evidence = key && (hasMore || previous.version === 5) ? await readReceiptFingerprint(tx, site, filter) : null
    if (previous.version === 5 && (previous.evidence !== evidence || counted.remaining < 0 || counted.remaining > 0 && !next))
      throw new CheckResultSelectionChanged('evidence')
    if (!hasMore) return { ...page, total: counted.total, nextCursor: null }
    if (key && evidence) {
      const cursor = { ...next, version: 5 as const, snapshot: versionedScope(next.snapshot!, 5), evidence,
        total: counted.total, remaining: counted.remaining }
      return { ...page, total: counted.total, nextCursor: encodeCursor({ ...cursor, signature: signSnapshotCursor(cursor, key).toString('hex') }) }
    }
    return { ...page, total: counted.total,
      nextCursor: encodeCursor({ ...next, version: 4, snapshot: versionedScope(next.snapshot!, 4), evidence: counted.evidence }) }
  }, { isolationLevel: 'RepeatableRead', timeout: 15_000 })
}

/** Paginate observations, not merely receipts containing potentially hundreds of entities. */
async function readSiteCheckResultPage(database: ResultDatabase, site: SiteRecord,
  latestAudit: string | { id: string; status: string; createdAt: Date } | null, rawCursor?: string,
  categoryEvidence?: Map<CategoryArea, CategoryEvidenceAudit>, filter: CheckResultFilter = {}) {
  const latestAuditId = typeof latestAudit === 'string' ? latestAudit : latestAudit?.id ?? null
  if (!latestAuditId || (!site.projectId && !site.primaryAuditId)) return { results: [], nextCursor: null, total: 0 }
  const categories = categoryEvidence ?? (typeof latestAudit === 'object' && latestAudit
    ? applicableCategoryEvidence(await loadCategoryEvidence(site.projectId ? [{ projectId: site.projectId, auditId: latestAudit.id }] : []), latestAudit) : new Map<CategoryArea, CategoryEvidenceAudit>())
  const categoryIds = [...categories.values()].map(audit => audit.id)
  const currentIds = [latestAuditId, ...categoryIds]
  let projection = 'category-observation-history-v3'
  if (!filter.area || filter.area === 'search') projection += ':search-gaps-v2'
  if (!filter.area || REASSIGNED_CHECK_ASSERTION_AREAS.has(filter.area)) projection += ':recorded-assertion-areas-v1'
  projection += ':task-binding-v1'
  const snapshot = createHash('sha256').update(JSON.stringify([projection, site.siteId ?? site.projectId ?? site.primaryAuditId, latestAuditId, filter.area ?? null, filter.pageUrl ?? null,
    [...categories].map(([area, audit]) => [area, audit.id]).sort(([a], [b]) => a.localeCompare(b))])).digest('hex')
  const auditWhere = site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId! }
  const cursor = decodeCursor(rawCursor)
  const legacySnapshot = createHash('sha256').update(JSON.stringify([latestAuditId,
    [...categories].map(([area, audit]) => [area, audit.id]).sort(([a], [b]) => a.localeCompare(b))])).digest('hex')
  // Legacy offsets within a receipt cannot follow a changed assertion projection.
  // Physical continuations at the beginning or end of a receipt remain usable.
  const legacyScopeChanged = cursor.version < 3 && (filter.area || filter.pageUrl || cursor.offset > 0 && cursor.offset < 600 ||
    [...categories.keys()].some(area => REASSIGNED_CHECK_ASSERTION_AREAS.has(area)))
  if (rawCursor && ((cursor.version === 4 || cursor.version === 5) && cursor.snapshot !== versionedScope(snapshot, cursor.version) || cursor.version === 3 && cursor.snapshot !== snapshot || cursor.version === 2 && cursor.snapshot !== legacySnapshot ||
    legacyScopeChanged))
    throw new CheckResultSelectionChanged()
  const currentWhere = { in: currentIds }
  // A selected category run can contain observations owned by another area.
  // Project each result against its current source before excluding history.
  const historyWhere = categories.size ? undefined : { not: latestAuditId }
  const encodeNext = (phase: ResultCursor['phase'], receiptId: string | null, offset: number) =>
    encodeCursor({ version: 3, phase, receiptId, offset, snapshot })
  if (cursor.receiptId) {
    const permitted = await database.auditVerifierExecution.findFirst({
      where: { id: cursor.receiptId, targetKey: { startsWith: 'module:' }, audit: auditWhere,
        auditId: cursor.phase === 'current' ? currentWhere : historyWhere },
      select: { id: true },
    })
    if (!permitted) throw new CheckResultSelectionChanged()
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
      select: { id: true, auditId: true, targetKey: true, pageUrl: true, source: true, status: true, detail: true, taskId: true, updatedAt: true },
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
