import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assessSearchRecovery } from './recovery'
import { currentExecutionOwnership, executionWrite } from '@/lib/audit/execution-ownership'
import { SEARCH_DEFINITIONS } from './definitions'
import { collectSearchEvidence, type SearchResourceCache } from './collect'
import { evaluateSearch, evaluateCheckedPageTitles, searchFindings } from './registry'
import { searchReceiptSchema, searchVerifierSchema, type SearchObservation, type SearchReceipt } from './contracts'
import { recordVerifierExecution } from '@/lib/improvements/verifier-provenance'
import { parseAffectedPaths } from '@/lib/audit/flag-identity'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import { boundSearchObservations } from './observation-bounds'

export const SEARCH_LOCAL_MODULES = SEARCH_DEFINITIONS.filter(item => !['google', 'cross-page'].includes(item.evaluator))
  .map(item => 'module:search-' + item.evaluator)

/** Aggregate receipts are bounded views. Source tasks retain every committed part. */
export function combineSearchReceipts(input: { auditId: string; pageUrl: string; receipts: SearchReceipt[]; expected: number }): SearchReceipt {
  const observations = boundSearchObservations(input.receipts.flatMap(receipt => receipt.observations), 'summary')
  const complete = input.receipts.length === input.expected && input.receipts.every(receipt => receipt.complete) &&
    !observations.some(item => item.disposition === 'unknown')
  return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: input.auditId, pageUrl: input.pageUrl,
    collectedAt: input.receipts.map(receipt => receipt.collectedAt).sort().at(-1) ?? new Date().toISOString(), complete, observations })
}

/** Compatibility adapters keep historical module receipts distinct from Search assertions. */
export async function priorSearchReceipt(auditId: string, pageUrl: string, evaluator?: string): Promise<SearchReceipt | null> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { parentId: true } })
  if (!audit?.parentId) return null
  if (evaluator) {
    const part = await prisma.auditVerifierExecution.findUnique({ where: { auditId_targetKey_scopeKey: {
      auditId: audit.parentId, targetKey: 'module:search-' + evaluator, scopeKey: `page:${pageUrl}` } }, select: { detail: true } })
    const parsed = searchReceiptSchema.safeParse(part?.detail)
    if (parsed.success && parsed.data.pageUrl === pageUrl) return parsed.data
  }
  const previous = await prisma.auditVerifierExecution.findUnique({
    where: { auditId_targetKey_scopeKey: { auditId: audit.parentId, targetKey: 'module:search', scopeKey: `page:${pageUrl}` } },
    select: { detail: true },
  })
  const parsed = searchReceiptSchema.safeParse(previous?.detail)
  if (parsed.success && parsed.data.pageUrl === pageUrl) return parsed.data
  const parts = await prisma.auditVerifierExecution.findMany({ where: { auditId: audit.parentId,
    pageUrl, targetKey: { in: SEARCH_LOCAL_MODULES } }, take: SEARCH_LOCAL_MODULES.length, select: { detail: true } })
  const receipts = parts.flatMap(part => { const result = searchReceiptSchema.safeParse(part.detail); return result.success ? [result.data] : [] })
  return receipts.length ? combineSearchReceipts({ auditId: audit.parentId, pageUrl, receipts, expected: SEARCH_LOCAL_MODULES.length }) : null
}

export async function persistSearchReceipt(receipt: SearchReceipt, module: 'search' | 'search-google' | 'search-cross-page' = 'search'): Promise<SearchReceipt> {
  const validated = searchReceiptSchema.parse(receipt)
  const stored = await executionWrite(tx => tx.auditVerificationReceipt.upsert({
    where: { auditId_targetKey_scopeKey: { auditId: validated.auditId, targetKey: `module:${module}`, scopeKey: `page:${validated.pageUrl}` } },
    create: { taskId: currentExecutionOwnership()?.taskId, auditId: validated.auditId, targetKey: `module:${module}`, scopeKey: `page:${validated.pageUrl}`,
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
      select: { flag: { select: { checkId: true, source: true, pageUrl: true, affectedPaths: true, fingerprint: true, attentionPolicy: true } } },
    } } } },
  })
  const seen = new Set<string>()
  for (const attempt of attempts) for (const occurrence of attempt.improvement.occurrences) {
    const flag = occurrence.flag, checkId = flag.checkId?.split('::page:')[0]
    const pages = [...parseAffectedPaths(flag.affectedPaths), ...(flag.pageUrl ? [flag.pageUrl] : [])].map(normalizeVerifierUrl)
    if (!checkId || !pages.includes(normalizeVerifierUrl(receipt.pageUrl)) || seen.has(checkId)) continue
    seen.add(checkId)
    const decision = assessSearchRecovery(receipt, checkId, flag.attentionPolicy, flag.pageUrl, pages)
    if (!decision.observationIds.length) continue
    const { verdict, comparable: established } = decision
    await recordVerifierExecution({ auditId: receipt.auditId, source: flag.source, checkId: flag.checkId,
      fingerprint: flag.fingerprint, pageUrl: receipt.pageUrl, status: established ? 'COMPLETED' : 'FAILED',
      evidenceReference: { auditId: receipt.auditId, module: 'search', pageUrl: receipt.pageUrl },
      detail: searchVerifierSchema.parse({ kind: 'search-verifier', version: 1, auditId: receipt.auditId, pageUrl: receipt.pageUrl,
        checkId, verdict, comparable: established,
        observationIds: decision.observationIds, reason: established ? 'responsibility_evaluated' : 'search_coverage_incomplete' }) }, db)
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
  const observations = boundSearchObservations(await (input.evaluate ?? evaluateSearch)(evidence, previous), 'http')
  const complete = !observations.some(item => item.disposition === 'unknown') && evidence.sitemapsComplete
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
