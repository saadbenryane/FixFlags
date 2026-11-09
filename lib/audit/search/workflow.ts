import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assessSearchRecovery } from './recovery'
import { currentExecutionOwnership, executionWrite } from '@/lib/audit/execution-ownership'
import { SEARCH_LOCAL_MODULES } from './definitions'
import { collectSearchEvidence, crawlNavigationTargets, type SearchResourceCache } from './collect'
import { evaluateSearch, evaluateCheckedPageTitles, searchFindings } from './registry'
import { readRecordedSearchReceipt, searchObservationSchema, searchReceiptSchema, searchVerifierSchema, SEARCH_OBSERVATION_LIMIT, type SearchComparisonBaseline,
  type SearchObservation, type SearchPageEvidence, type SearchReceipt } from './contracts'
import { recordVerifierExecution } from '@/lib/improvements/verifier-provenance'
import { parseAffectedPaths } from '@/lib/audit/flag-identity'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import { boundSearchObservations } from './observation-bounds'
import { hasUncoveredSearchObservations } from './completeness'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { readPendingFrozenRepairSources, verificationSourceAuditId } from '@/lib/sites/domain/verification-source'
import { readSupportingObservations } from '../flag-observations'
import { analysisEnvironmentSourceSql } from '@/lib/sites/application/analysis-scope'
import { searchResourceKey } from './resource-identity'
import { TaskFailure } from '../progressive/contracts'
import type { TaskAudit } from '../progressive/registry'

/** Aggregate receipts are bounded views. Source tasks retain every committed part. */
export function combineSearchReceipts(input: { auditId: string; pageUrl: string; receipts: SearchReceipt[]; expected: number }): SearchReceipt {
  const receipts = input.receipts.filter(receipt => receipt.auditId === input.auditId && receipt.pageUrl === input.pageUrl && receipt.observations.length > 0)
  const observations = boundSearchObservations(receipts.flatMap(receipt => receipt.observations), 'summary')
  const complete = receipts.length === input.receipts.length && receipts.length === input.expected && receipts.every(receipt => receipt.complete) &&
    !hasUncoveredSearchObservations([{ auditId: input.auditId, observations }])
  return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: input.auditId, pageUrl: input.pageUrl,
    collectedAt: receipts.map(receipt => receipt.collectedAt).sort().at(-1) ?? new Date().toISOString(), complete, observations })
}

/** Compatibility adapters keep historical module receipts distinct from Search assertions. */
export async function priorSearchReceipt(auditId: string, pageUrl: string, evaluator?: string): Promise<SearchReceipt | null> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { parentId: true, projectId: true, executionSpec: true } })
  if (!audit?.parentId) return null
  const sourceAuditId = await verificationSourceAuditId(prisma, audit, pageUrl)
  if (!sourceAuditId) return null
  const read = (targetKey: string, detail: unknown) => readRecordedSearchReceipt({ targetKey, detail, auditId: sourceAuditId, pageUrl })
  if (evaluator) {
    const targetKey = 'module:search-' + evaluator
    const part = await prisma.auditVerifierExecution.findUnique({ where: { auditId_targetKey_scopeKey: {
      auditId: sourceAuditId, targetKey, scopeKey: `page:${pageUrl}` } }, select: { detail: true } })
    const parsed = read(targetKey, part?.detail)
    if (parsed) return parsed
  }
  const previous = await prisma.auditVerifierExecution.findUnique({
    where: { auditId_targetKey_scopeKey: { auditId: sourceAuditId, targetKey: 'module:search', scopeKey: `page:${pageUrl}` } },
    select: { detail: true },
  })
  const parsed = read('module:search', previous?.detail)
  if (parsed) return parsed
  const parts = await prisma.auditVerifierExecution.findMany({ where: { auditId: sourceAuditId,
    pageUrl, targetKey: { in: SEARCH_LOCAL_MODULES } }, take: SEARCH_LOCAL_MODULES.length, select: { targetKey: true, detail: true } })
  const receipts = parts.map(part => read(part.targetKey, part.detail)).filter(result => result !== null)
  return receipts.length ? combineSearchReceipts({ auditId: sourceAuditId, pageUrl, receipts, expected: SEARCH_LOCAL_MODULES.length }) : null
}

/** An unavailable policy check leaves the latest decisive observation in
 * force. Broad and category runs can use owned history; repairs keep their
 * original immutable source receipt. */
export async function priorSearchPolicyBaseline(audit: Pick<TaskAudit, 'id' | 'parentId' | 'projectId' | 'createdAt' | 'executionSpec'>,
  evidence: SearchPageEvidence, evaluator: string): Promise<SearchComparisonBaseline | null> {
  if (!audit.parentId || !evidence.public || evaluator !== 'crawl' && evaluator !== 'indexing') return null
  const spec = readExecutionSpec(audit.executionSpec)
  const { pageUrl } = evidence
  if (!audit.projectId || !spec || spec.scope !== 'SITE' && spec.scope !== 'CATEGORY')
    return priorSearchReceipt(audit.id, pageUrl, evaluator)
  const crawl = evaluator === 'crawl'
  const originalKey = searchResourceKey(pageUrl)
  const keys = crawl ? crawlNavigationTargets(pageUrl, evidence.original).map(searchResourceKey) : [originalKey]
  const checkId = crawl ? 'search-crawl-access' : 'robots-blocks-indexing'
  const sourceKind = crawl ? 'robots-txt' : 'http'
  const receiptKey = 'module:search-' + evaluator
  // The Site's chronological index and the per-Audit receipt key let each
  // scope stop at its nearest matching observation, even after several gaps.
  const rows = await prisma.$queryRaw<Array<{ observation: unknown }>>`
    SELECT latest.observation FROM unnest(${keys}::text[]) AS scope(key)
    CROSS JOIN LATERAL (
      SELECT member.observation
      FROM audits source
      JOIN audit_verifier_executions receipt ON receipt."auditId" = source.id
        AND receipt."scopeKey" = ${'page:' + pageUrl} AND receipt."pageUrl" = ${pageUrl}
        AND receipt."targetKey" IN (${receiptKey}, 'module:search') AND receipt.status = 'COMPLETED' AND receipt.source = 'SEARCH'
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(receipt.detail->'observations') = 'array'
        THEN receipt.detail->'observations' ELSE '[]'::jsonb END) AS member(observation)
      WHERE source."projectId" = ${audit.projectId} AND source.status = 'COMPLETED'
        AND source."createdAt" < ${audit.createdAt} AND source."completedAt" <= ${audit.createdAt}
        AND ${analysisEnvironmentSourceSql(spec.environment)}
        AND (source."executionSpec"->>'scope' = 'SITE' OR (source."executionSpec"->>'scope' = 'CATEGORY'
          AND source."executionSpec"#>>'{category,area}' = 'search') OR source.id = ${audit.parentId})
        AND receipt.detail->>'kind' = 'search-checks' AND receipt.detail->>'auditId' = source.id
        AND receipt.detail->>'pageUrl' = ${pageUrl} AND member.observation->>'pageUrl' = ${pageUrl}
        AND member.observation->>'checkId' = ${checkId} AND member.observation->>'source' = ${sourceKind}
        AND member.observation->>'responsibility' = ${evaluator}
        AND COALESCE(member.observation->>'resourceKey', ${originalKey}) = scope.key
        AND member.observation->>'disposition' IN ('passed', 'failed', 'observed')
        AND member.observation->>'reason' <> 'indexing_comparison_incomplete'
      ORDER BY source."createdAt" DESC, source.id DESC, (receipt."targetKey" = ${receiptKey}) DESC
      LIMIT 1
    ) latest
  `
  const observations = rows.flatMap(row => {
    const parsed = searchObservationSchema.safeParse(row.observation)
    return parsed.success ? [parsed.data] : []
  })
  return observations.length ? { pageUrl, observations } : null
}

export async function persistSearchReceipt(receipt: SearchReceipt, module: 'search' | 'search-google' | 'search-cross-page' = 'search'): Promise<SearchReceipt> {
  const targetKey = `module:${module}`
  const scope = { targetKey, auditId: receipt.auditId, pageUrl: receipt.pageUrl }
  const validated = readRecordedSearchReceipt({ ...scope, detail: receipt })
  if (!validated) throw new TaskFailure('SEARCH_RECEIPT_SCOPE_MISMATCH', false)
  const stored = await executionWrite(tx => tx.auditVerificationReceipt.upsert({
    where: { auditId_targetKey_scopeKey: { auditId: validated.auditId, targetKey, scopeKey: `page:${validated.pageUrl}` } },
    create: { taskId: currentExecutionOwnership()?.taskId, auditId: validated.auditId, targetKey, scopeKey: `page:${validated.pageUrl}`,
      source: 'SEARCH', pageUrl: validated.pageUrl, status: 'COMPLETED', detail: validated as Prisma.InputJsonValue,
      evidenceReference: { auditId: validated.auditId, pageUrl: validated.pageUrl, module } },
    // A repeated projection cannot replace the observation that established this execution.
    update: {},
    select: { detail: true },
  }))
  const recorded = readRecordedSearchReceipt({ ...scope, detail: stored.detail })
  if (!recorded) throw new TaskFailure('SEARCH_RECEIPT_SCOPE_MISMATCH', false)
  return recorded
}

/** A verifier is recorded only for the actual responsibility and comparable entity types. */
export async function recordSearchVerifiers(receipt: SearchReceipt, db: typeof prisma | Prisma.TransactionClient = prisma): Promise<void> {
  if (db === prisma && currentExecutionOwnership()) return executionWrite(tx => recordSearchVerifiers(receipt, tx))
  const audit = await db.audit.findUnique({ where: { id: receipt.auditId }, select: { parentId: true, projectId: true, executionSpec: true } })
  if (!audit?.parentId) return
  const spec = readExecutionSpec(audit.executionSpec)
  if (audit.executionSpec != null && !spec) return
  const sourceFlagIds = spec?.verificationSourceFlagIds
  const observesCanonicals = receipt.observations.some(item => item.checkId === 'search-canonical-target')
  const flags = spec?.verificationSources
    ? await readPendingFrozenRepairSources(db, { ...audit, id: receipt.auditId }, spec)
    : (await db.improvementAttempt.findMany({
      where: { sourceAuditId: audit.parentId, outcome: null },
      select: { improvement: { select: { occurrences: {
        where: sourceFlagIds ? { flagId: { in: sourceFlagIds } } : { auditId: audit.parentId },
        select: { flag: { select: { checkId: true, source: true, pageUrl: true, affectedPaths: true, fingerprint: true, attentionPolicy: true,
          ...(observesCanonicals ? { supportingObservations: true } : {}) } } },
      } } } },
    })).flatMap(attempt => attempt.improvement.occurrences.map(occurrence => occurrence.flag))
  if (!flags) return
  const observedPage = normalizeVerifierUrl(receipt.pageUrl)
  const groups = new Map<string, { flag: typeof flags[number]; decisions: ReturnType<typeof assessSearchRecovery>[] }>()
  for (const flag of flags) {
    const checkId = flag.checkId?.split('::page:')[0]
    const pages = [...parseAffectedPaths(flag.affectedPaths), ...(flag.pageUrl ? [flag.pageUrl] : [])].map(normalizeVerifierUrl)
    if (!checkId || !pages.includes(observedPage)) continue
    const group = groups.get(checkId) ?? { flag, decisions: [] }
    if (observesCanonicals && checkId === 'search-canonical-target' && flag.supportingObservations != null) {
      const originals = readSupportingObservations(flag.supportingObservations)?.items.filter(item =>
        item.pageUrl && normalizeVerifierUrl(item.pageUrl) === observedPage && item.checkId?.split('::page:')[0] === checkId)
      if (originals?.length) group.decisions.push(...originals.map(item => assessSearchRecovery(receipt, checkId,
        item.provenance && item.checkVersion && (!spec || item.checkVersion === spec.checks[checkId]) ? item.attentionPolicy : null,
        item.pageUrl, undefined, item)))
      else group.decisions.push(assessSearchRecovery(receipt, checkId, null, flag.pageUrl, pages))
    } else group.decisions.push(assessSearchRecovery(receipt, checkId, flag.attentionPolicy, flag.pageUrl, pages))
    groups.set(checkId, group)
  }
  for (const [checkId, { flag, decisions }] of groups) {
    const failures = decisions.filter(decision => decision.comparable && decision.verdict === 'failed')
    const verdict = failures.length ? 'failed' : decisions.every(decision => decision.verdict === 'passed') ? 'passed' : 'unknown'
    const observationIds = [...new Set((failures.length ? failures : decisions).flatMap(decision => decision.observationIds))].slice(0, SEARCH_OBSERVATION_LIMIT)
    if (!observationIds.length) continue
    const established = verdict !== 'unknown'
    await recordVerifierExecution({ auditId: receipt.auditId, source: flag.source, checkId: flag.checkId,
      fingerprint: flag.fingerprint, pageUrl: receipt.pageUrl, status: established ? 'COMPLETED' : 'FAILED',
      evidenceReference: { auditId: receipt.auditId, module: 'search', pageUrl: receipt.pageUrl },
      detail: searchVerifierSchema.parse({ kind: 'search-verifier', version: 1, auditId: receipt.auditId, pageUrl: receipt.pageUrl,
        checkId, verdict, comparable: established,
        observationIds, reason: established ? 'responsibility_evaluated' : 'search_coverage_incomplete' }) }, db)
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
    const saved = readRecordedSearchReceipt({ targetKey: 'module:search', detail: existing.detail, auditId: input.auditId, pageUrl: input.pageUrl })
    if (!saved) throw new TaskFailure('SEARCH_RECEIPT_SCOPE_MISMATCH', false)
    return { receipt: saved, findings: searchFindings(saved.observations) }
  }
  const evidence = await collectSearchEvidence(input)
  const previous = await priorSearchReceipt(input.auditId, input.pageUrl)
  const observations = boundSearchObservations(await (input.evaluate ?? evaluateSearch)(evidence, previous), 'http')
  const complete = !hasUncoveredSearchObservations([{ auditId: input.auditId, observations }]) && evidence.sitemapsComplete
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
