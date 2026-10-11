import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { executionWrite } from '@/lib/audit/execution-ownership'
import { SEARCH_DEFINITIONS } from './definitions'
import { collectSearchEvidence, type SearchResourceCache } from './collect'
import { evaluateSearch, evaluateCheckedPageTitles, searchFindings } from './registry'
import { searchReceiptSchema, searchAttentionSchema, searchVerifierSchema, type SearchObservation, type SearchReceipt } from './contracts'
import { recordVerifierExecution } from '@/lib/improvements/verifier-provenance'

export const SEARCH_LOCAL_MODULES = SEARCH_DEFINITIONS.filter(item => !['google', 'cross-page'].includes(item.evaluator))
  .map(item => 'module:search-' + item.evaluator)

/** Aggregate receipts are bounded views. Source tasks retain every committed part. */
export function combineSearchReceipts(input: { auditId: string; pageUrl: string; receipts: SearchReceipt[]; expected: number }): SearchReceipt {
  let observations = input.receipts.flatMap(receipt => receipt.observations)
  let complete = input.receipts.length === input.expected && input.receipts.every(receipt => receipt.complete)
  if (observations.length > 499) {
    observations = observations.slice(0, 499)
    observations.push({ ...observations[0], id: 'search-observation-coverage:summary', checkId: 'search-observation-coverage',
      disposition: 'unknown', reason: 'observation_limit', observed: 'The summary observation limit was reached. Source results remain recorded.',
      attention: { policy: 'search', version: 1, kind: 'observation', reason: 'observation_limit' } })
    complete = false
  }
  return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: input.auditId, pageUrl: input.pageUrl,
    collectedAt: input.receipts.map(receipt => receipt.collectedAt).sort().at(-1) ?? new Date().toISOString(), complete, observations })
}

/** Compatibility adapters keep historical module receipts distinct from Search assertions. */
export async function priorSearchReceipt(auditId: string, pageUrl: string): Promise<SearchReceipt | null> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { parentId: true } })
  if (!audit?.parentId) return null
  const previous = await prisma.auditVerifierExecution.findUnique({
    where: { auditId_targetKey_scopeKey: { auditId: audit.parentId, targetKey: 'module:search', scopeKey: `page:${pageUrl}` } },
    select: { detail: true },
  })
  const parsed = searchReceiptSchema.safeParse(previous?.detail)
  if (parsed.success && parsed.data.pageUrl === pageUrl) return parsed.data
  const parts = await prisma.auditVerifierExecution.findMany({ where: { auditId: audit.parentId,
    pageUrl, targetKey: { in: SEARCH_LOCAL_MODULES } }, select: { detail: true } })
  const receipts = parts.flatMap(part => { const result = searchReceiptSchema.safeParse(part.detail); return result.success ? [result.data] : [] })
  return receipts.length ? combineSearchReceipts({ auditId: audit.parentId, pageUrl, receipts, expected: SEARCH_LOCAL_MODULES.length }) : null
}

export async function persistSearchReceipt(receipt: SearchReceipt, module: 'search' | 'search-google' | 'search-cross-page' = 'search'): Promise<SearchReceipt> {
  const validated = searchReceiptSchema.parse(receipt)
  const stored = await executionWrite(tx => tx.auditVerifierExecution.upsert({
    where: { auditId_targetKey_scopeKey: { auditId: validated.auditId, targetKey: `module:${module}`, scopeKey: `page:${validated.pageUrl}` } },
    create: { auditId: validated.auditId, targetKey: `module:${module}`, scopeKey: `page:${validated.pageUrl}`,
      source: 'SEARCH', pageUrl: validated.pageUrl, status: 'COMPLETED', detail: validated as Prisma.InputJsonValue,
      evidenceReference: { auditId: validated.auditId, pageUrl: validated.pageUrl, module } },
    // A repeated projection cannot replace the observation that established this execution.
    update: {},
    select: { detail: true },
  }))
  return searchReceiptSchema.parse(stored.detail)
}

/** A verifier is recorded only for the actual responsibility and comparable entity types. */
export async function recordSearchVerifiers(receipt: SearchReceipt, db: typeof prisma | Prisma.TransactionClient = prisma): Promise<void> {
  const audit = await db.audit.findUnique({ where: { id: receipt.auditId }, select: { parentId: true } })
  if (!audit?.parentId) return
  const attempts = await db.improvementAttempt.findMany({
    where: { sourceAuditId: audit.parentId, outcome: null },
    select: { improvement: { select: { occurrences: {
      where: { auditId: audit.parentId },
      select: { flag: { select: { checkId: true, source: true, pageUrl: true, fingerprint: true, attentionPolicy: true } } },
    } } } },
  })
  const seen = new Set<string>()
  for (const attempt of attempts) for (const occurrence of attempt.improvement.occurrences) {
    const flag = occurrence.flag, checkId = flag.checkId?.split('::page:')[0]
    if (!checkId || flag.pageUrl !== receipt.pageUrl || seen.has(checkId)) continue
    seen.add(checkId)
    const policy = searchAttentionSchema.safeParse(flag.attentionPolicy)
    const sources = policy.success ? policy.data.sources ?? [] : []
    const observations = receipt.observations.filter(item => item.checkId === checkId && (!sources.length || sources.includes(item.source)))
    if (!observations.length) continue
    const expectedTypes = policy.success ? policy.data.entityTypes ?? [] : []
    const typesObserved = new Set(observations.flatMap(item => item.entityTypes ?? []))
    const comparable = !receipt.observations.some(item => item.reason === 'observation_limit') && observations.every(item => item.disposition !== 'unknown' && item.disposition !== 'not_applicable') &&
      sources.every(source => observations.some(item => item.source === source)) &&
      expectedTypes.every(type => typesObserved.has(type))
    const googleComparable = observations.every(item => {
      if (item.source !== 'google-index') return true
      const current = item.google, before = policy.success ? policy.data.google : undefined
      if (!current || !before || current.property !== before.property) return false
      return item.disposition === 'failed' || item.disposition === 'passed' && Boolean(current.lastCrawlAt && before.lastCrawlAt &&
        new Date(current.lastCrawlAt) > new Date(before.lastCrawlAt))
    })
    const verifiedConflictRemoval = policy.success && policy.data.reason === 'sitemap_indexing_conflict' &&
      receipt.complete && observations.every(item => item.reason === 'declared_indexing_exclusion' || item.disposition === 'passed')
    const targets = policy.success ? policy.data.markupTargets ?? [] : []
    const verifiedProperties = targets.length > 0 && targets.every(target => observations.some(item =>
      item.entityId === target.entityId && item.entityTypes?.includes(target.entityType) && item.source === target.source &&
      item.invalidProperties !== undefined && !target.properties.some(property => item.invalidProperties!.includes(property))))
    const verdict = !comparable || !googleComparable ? 'unknown' : observations.some(item => item.disposition === 'failed') ? 'failed'
      : observations.every(item => item.disposition === 'passed') || verifiedConflictRemoval || verifiedProperties ? 'passed' : 'unknown'
    const established = comparable && verdict !== 'unknown'
    await recordVerifierExecution({ auditId: receipt.auditId, source: flag.source, checkId: flag.checkId,
      fingerprint: flag.fingerprint, pageUrl: receipt.pageUrl, status: established ? 'COMPLETED' : 'FAILED',
      evidenceReference: { auditId: receipt.auditId, module: 'search', pageUrl: receipt.pageUrl },
      detail: searchVerifierSchema.parse({ kind: 'search-verifier', version: 1, auditId: receipt.auditId, pageUrl: receipt.pageUrl,
        checkId, verdict, comparable: established,
        observationIds: observations.map(item => item.id), reason: established ? 'responsibility_evaluated' : 'search_coverage_incomplete' }) }, db)
  }
}

export async function runSearchWorkflow(input: Parameters<typeof collectSearchEvidence>[0] & {
  evaluate?: typeof evaluateSearch;
}) {
  const existing = await prisma.auditVerifierExecution.findUnique({
    where: { auditId_targetKey_scopeKey: { auditId: input.auditId, targetKey: 'module:search', scopeKey: `page:${input.pageUrl}` } },
    select: { detail: true },
  })
  if (existing) {
    const saved = searchReceiptSchema.parse(existing.detail)
    return { receipt: saved, findings: searchFindings(saved.observations) }
  }
  const evidence = await collectSearchEvidence(input)
  const previous = await priorSearchReceipt(input.auditId, input.pageUrl)
  let observations = await (input.evaluate ?? evaluateSearch)(evidence, previous)
  let complete = !observations.some(item => item.disposition === 'unknown') && evidence.sitemapsComplete
  if (observations.length > 499) {
    observations = observations.slice(0, 499)
    const template = observations[0]
    observations.push({ ...template, id: 'search-observation-coverage:http', checkId: 'search-observation-coverage',
      responsibility: 'structured-data', disposition: 'unknown', reason: 'observation_limit', observed: 'The observation limit was reached. Remaining evidence is not certified.',
      attention: { policy: 'search', version: 1, kind: 'observation', reason: 'observation_limit' } })
    complete = false
  }
  const receipt = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: input.auditId, pageUrl: input.pageUrl,
    collectedAt: evidence.collectedAt, complete, observations })
  const stored = await persistSearchReceipt(receipt)
  await recordSearchVerifiers(stored)
  return { receipt: stored, findings: searchFindings(stored.observations) }
}

export async function runCheckedPageSearch(receipts: SearchReceipt[]) {
  const results = evaluateCheckedPageTitles(receipts)
  const findings = []
  for (const receipt of receipts) {
    const observations = results.get(receipt.pageUrl)
    if (!observations) continue
    const stored = await persistSearchReceipt({ ...receipt, complete: true, observations }, 'search-cross-page')
    findings.push(...searchFindings(stored.observations))
  }
  return findings
}

export type { SearchResourceCache, SearchObservation }
