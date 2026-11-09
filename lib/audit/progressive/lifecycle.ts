import { checkExecution } from './check-execution'
import { CHECK_REGISTRY } from '../check-registry'
import { CHECK_MODULES } from '@/lib/audit/checks/definitions'
import { journeyAssessmentSchema, hasIncompleteJourneyAssessment, type JourneyAssessment } from '../journey/evaluation-grounding'
import { Prisma, type AuditExecutionTask } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { readDiagnosticSources } from '@/lib/sites/domain/verification-source'
import { executionWrite } from '../execution-ownership'
import { loadTaskGraph, persistTaskPlan } from './engine'
import { serializeArtifact, readArtifact, TaskFailure, prescriptionResultSchema, type TaskPlan, type TaskArtifact, MAX_TASKS_PER_AUDIT } from './contracts'
import { pageTaskPlan } from './graph'
import { browserArtifactSchema, captureArtifactSchema, httpArtifactSchema, readSettledPageSpeedEvidence, screenshotSnapshotSchema } from './snapshots'
import { browserEvidence, captureEvidence, searchArtifactSchema } from './evaluators'
import { flagSchema, commitFindings, recordedTaskFindings } from './results'
import { recordedFindingArtifactsSql } from './recorded-findings'
import { OBSERVATION_TARGETS, commitObservation, nextObservationBatch, observationArtifact, observationBatchStart, observationProgressSchema, observationTotal } from './observation-progress'
import { journeyRunSchema, selectJourneyRuns } from '../journey/review-scope'
import { parseProductContract } from '../product-contract'
import { detectPagePurpose } from '../page-purpose'
import { asReviewDepth, planReviewTargets, openCheckCeilingForDepth, buildReviewCoverage, INTERNAL_REVIEW_PAGE_CEILING } from '../review-depth'
import { openCheckDestinations } from '../open-check'
import { navigationDestinationKey } from '../url-identity'
import { capturedPageLinks, publicLinkUrls, resolvedPageLinks } from '../checks/public-links'
import { resolvedPublicLinkCoverageGaps } from '../checks/public-link-coverage'
import { documentEvidenceWithheld } from '../browser/document-evidence'
import { DISCOVERY_BATCH_SIZE, discoveryMemberSchema, planRecordedDiscoveryObservations, discoveryObservations,
  discoveryResponses, discoveryResponsesSchema, previousDiscoveryResponses } from './discovery'
import { renderedSearchSnapshotSchema } from '../search/rendered-snapshot'
import { checkReceiptSchema } from '../checks/receipt'
import { commitCheckReceipt } from './results'
import { overlayCheckReceipts, overlayReceiptScope, overlayTargetSchema, scopedOverlayRule, runObservedOverlayChecks, type OverlayObservation } from '../checks/overlay-evidence'
import { capturePageKey } from '../browser/observation-scope'
import { JOURNEY_ASSERTIONS, journeyReceipts, journeyReceiptScope, nativeJourneyFlags, type JourneyObservation } from '../checks/journey-evidence'
import { loadRecordedJourneyConditions, originalJourneyConditions } from '../journey/recorded-conditions'
import type { JourneyFindingDraft } from '../journey/types'
import { durableCheckId } from '../flag-identity'
import { runCheckedPageSearch } from '../search/workflow'
import { evaluateCorridorConsistency } from '../checks/corridor-consistency'
import { pagePreviewSchema, pagePreviewForComparison, publicPagePreviewForComparison } from '../checks/page-preview'
import { corridorEvidenceSource } from '../checks/corridor-contract'
import { runBoundOutcomeExecutions } from '@/lib/sites/application/checkout-execution'
import { reconcileSafeFixtureCleanup, executeSafeFormFixture, safeFormExecutionResultSchema } from '@/lib/sites/application/safe-form-executor'
import { runJourneyReviewsForAudit } from '../journey/run-journey-reviews'
import { resolveAuditScanAccess } from '../scan-access-store'
import { systemClock } from '@/lib/time/clock'
import { createPipelineEventSink } from '../pipeline-log'
import { judgePageStage } from '../pipeline/stages/judge-page'
import { triageAssessmentSchema } from '../triage-grounding'
import { triageOutputSchema } from '../judge-triage-schema'
import { finalizeFromOutcome } from '../pipeline/finalize-from-outcome'
import { finalizeTriageDegraded, persistImprovementCycle } from '../finalize'
import { persistDeterministicFlags } from '../persist'
import { currentPageSpeedLab, productScoresFromFlags } from '../pipeline/combine-pages'
import { readScreenshot } from '@/lib/storage/screenshots'
import type { PageEvidence, PageRun, PipelineContext } from '../pipeline/types'
import type { TaskContext, TaskHandler } from './registry'
import { persistAuditRunCost } from '@/lib/billing/costs'
import { scheduleOptionalAiReview } from '../enqueue-ai-review'
import { runAiReview, type PrescriptionRunUsage } from '../run-ai-review'
import { PrescriptionScopeChanged } from '../prescription-scope'
import { JudgeContractError } from '../validate-judge-output'
import { admitAiObservation } from '../ai-observation-identity'
import { settleRecordedPages } from './page-settlement'
import { llmUsageSchema } from '../provider-usage-contract'
import { persistAuditGraphSnapshot } from '@/lib/graph/snapshot'
import { logger } from '@/lib/logger'

const findingsSchema = z.object({ flags: z.array(flagSchema).max(500) }).strict()
const crossPageSchema = findingsSchema.extend({ receipts: z.array(checkReceiptSchema).max(24).optional() }).strict()
const discoveryCoverageSchema = z.object({ openCheckCount: z.number().int().nonnegative().max(120), truncated: z.boolean() })
const discoverySchema = discoveryCoverageSchema.extend({ flags: z.array(flagSchema).max(500),
  pages: z.array(z.string().url()).max(24),
  responses: discoveryResponsesSchema.optional(), responseCollectedAt: z.string().datetime().optional(),
  receipts: z.array(checkReceiptSchema).max(24).optional(), observationProgress: observationProgressSchema.optional() }).strict()
const bindingSchema = z.object({ executed: z.boolean(), outcomeId: z.string(), bindingKey: z.string() }).strict()
const journeySchema = z.object({ findingCount: z.number().int().nonnegative(), assessments: z.array(journeyAssessmentSchema).max(6).optional(), flags: z.array(flagSchema).max(500).optional(), overlayReceipts: z.array(checkReceiptSchema).max(100).optional(), pageReceipts: z.array(checkReceiptSchema).max(100).optional(), observationProgress: observationProgressSchema.optional() }).strict()
const judgeSchema = z.object({ triage: z.object({ output: triageOutputSchema, usage: llmUsageSchema, assessment: triageAssessmentSchema.optional() }).strict().optional(),
  triageFailure: z.object({ reason: z.enum(['no_provider_keys', 'deadline_exhausted', 'provider_exhausted', 'budget_unavailable', 'contract_invalid', 'unknown']),
    message: z.string(), retryable: z.boolean() }).strict().optional() }).strict()
const finalSchema = z.object({ status: z.literal('COMPLETED'), partial: z.boolean() }).strict()

async function pipelineContext(context: TaskContext): Promise<PipelineContext> {
  const trace = { executionId: context.task.id, traceId: context.audit.id, attempt: context.task.workAttempts }
  return { auditId: context.audit.id, deadline: context.deadline, startedAt: context.audit.startedAt ?? context.audit.createdAt,
    clock: systemClock, trace, events: createPipelineEventSink(context.audit.id, trace, systemClock),
    pagespeedCalls: 0, usage: { inputTokens: 0, outputTokens: 0, models: [] }, includeAi: context.audit.includeAi,
    scanAccess: await resolveAuditScanAccess(context.audit.id) }
}

type ModuleGap = { pageUrl: string | null; targetKey: string }

/** Finalization and page evidence share one bounded projection of admitted gaps. */
async function recordedModuleGaps(auditId: string, db: Pick<Prisma.TransactionClient, '$queryRaw'>, pageUrl?: string) {
  const scopedReceipt = Prisma.sql`receipt."detail"->>'version' = '1' AND receipt."detail"->>'kind' IN ('site-module-check', 'search-checks')`
  // Modern receipts can describe a different page than their coordinating task.
  const pageScope = Prisma.sql`CASE WHEN ${scopedReceipt} THEN COALESCE(receipt."pageUrl", task."pageUrl")
    ELSE COALESCE(task."pageUrl", receipt."pageUrl") END`
  const gap = Prisma.sql`(receipt."detail"->>'complete' = 'false' OR receipt."detail"->'failed' = 'true'::jsonb
    OR receipt."detail"->'assertions' @> '[{"complete":false}]'::jsonb)`
  const linkScope = Prisma.sql`(receipt."targetKey" = 'module:seo' AND receipt."status" = 'COMPLETED')`
  const firstLinks = Prisma.sql`starts_with(receipt."scopeKey", 'page:' || receipt."pageUrl" || ':public-links:first')`
  const secondLinks = Prisma.sql`starts_with(receipt."scopeKey", 'page:' || receipt."pageUrl" || ':public-links:second')`
  const linkReceipt = Prisma.sql`(${linkScope} AND (${gap} AND ${firstLinks} OR ${secondLinks} AND link_gap."pageUrl" IS NOT NULL))`
  const rows = await db.$queryRaw<Array<ModuleGap & { gap: boolean | null; status: string | null; scopeKey: string | null; detail: unknown }>>`
    WITH link_gap_pages AS (
      SELECT DISTINCT receipt."pageUrl" FROM "audit_verifier_executions" receipt
      WHERE receipt."auditId" = ${auditId} AND ${linkScope} AND ${firstLinks} AND ${gap}
        ${pageUrl ? Prisma.sql`AND receipt."pageUrl" = ${pageUrl}` : Prisma.empty}
    )
    SELECT DISTINCT ${pageScope} AS "pageUrl", receipt."targetKey", ${gap} AS gap,
      CASE WHEN ${linkReceipt} THEN receipt."scopeKey" END AS "scopeKey",
      CASE WHEN ${linkReceipt} THEN receipt."status" END AS status,
      CASE WHEN ${linkReceipt} THEN jsonb_build_object(
        'kind', receipt."detail"->'kind', 'version', receipt."detail"->'version', 'module', receipt."detail"->'module',
        'pageUrl', receipt."detail"->'pageUrl', 'applicable', receipt."detail"->'applicable', 'complete', receipt."detail"->'complete',
        'failed', receipt."detail"->'failed', 'limitation', receipt."detail"->'limitation', 'execution', receipt."detail"->'execution',
        'publicLinkInventoryComplete', receipt."detail"->'publicLinkInventoryComplete',
        'assertions', (SELECT jsonb_agg(jsonb_build_object('key', assertion->'key', 'context', assertion->'context',
          'complete', assertion->'complete', 'disposition', assertion->'disposition'))
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(receipt."detail"->'assertions') = 'array'
            THEN receipt."detail"->'assertions' ELSE '[]'::jsonb END) assertion)) END AS detail
    FROM "audit_verifier_executions" receipt
    LEFT JOIN link_gap_pages link_gap ON link_gap."pageUrl" = receipt."pageUrl"
    LEFT JOIN "audit_execution_tasks" task ON task."id" = receipt."taskId"
      AND task."auditId" = receipt."auditId"
    WHERE receipt."auditId" = ${auditId} AND receipt."targetKey" LIKE 'module:%'
      AND receipt."status" <> 'NOT_APPLICABLE'
      AND (${gap} OR ${linkReceipt})
      AND CASE WHEN ${scopedReceipt} THEN
        (receipt."pageUrl" IS NULL OR COALESCE(receipt."detail"->>'pageUrl', receipt."pageUrl") = receipt."pageUrl")
        AND CASE WHEN receipt."detail"->>'kind' = 'search-checks' THEN
          COALESCE(receipt."detail"->>'auditId', receipt."auditId") = receipt."auditId"
        ELSE
          COALESCE('module:' || (receipt."detail"->>'module'), receipt."targetKey") = receipt."targetKey"
          AND COALESCE(receipt."detail"#>>'{execution,auditId}', receipt."auditId") = receipt."auditId"
          AND (receipt."taskId" IS NULL
            OR COALESCE(receipt."detail"#>>'{execution,taskId}', receipt."taskId") = receipt."taskId")
        END
      ELSE true END
      ${pageUrl ? Prisma.sql`AND (${pageScope}) = ${pageUrl}` : Prisma.empty}
    LIMIT ${MAX_TASKS_PER_AUDIT + 1}`
  if (rows.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
  const resolved = resolvedPublicLinkCoverageGaps(rows, auditId)
  const gaps = new Map<string, ModuleGap>()
  for (const row of rows) {
    const { pageUrl, targetKey } = row
    if (row.gap && !resolved.has(row)) gaps.set(JSON.stringify([pageUrl, targetKey]), { pageUrl, targetKey })
  }
  return [...gaps.values()]
}

/** Each task's current artifact is cumulative, including a committed checkpoint
 * before exhaustion. Reading earlier batch receipts would count the work twice. */
async function recordedDiscoveryCoverage(auditId: string, expected: number) {
  if (!expected) return { openCheckCount: 0, partial: false }
  const rows = await prisma.$queryRaw<Array<{ workState: string; coverage: unknown }>>`
    SELECT "workState", CASE WHEN "workResult"->>'kind' = 'discovery' AND "workResult"->>'version' = '1' THEN
      jsonb_build_object('openCheckCount', "workResult"#>'{data,openCheckCount}', 'truncated', "workResult"#>'{data,truncated}')
      ELSE NULL END AS coverage
    FROM "audit_execution_tasks"
    WHERE "auditId" = ${auditId} AND "workKind" = 'discovery' AND status <> 'NOT_APPLICABLE'
    LIMIT ${expected + 1}`
  let openCheckCount = 0, partial = rows.length !== expected
  for (const row of rows) {
    const parsed = discoveryCoverageSchema.safeParse(row.coverage)
    if (parsed.success) openCheckCount += parsed.data.openCheckCount
    if (!parsed.success || parsed.data.truncated || row.workState !== 'COMPLETED') partial = true
  }
  return { openCheckCount, partial }
}

/** All scope is recovered from admitted tasks and their committed collectors, never
 * rediscovered during finalization. Missing input remains missing. */
type RecordedPageEvidence = PageEvidence & { primary: boolean }
export async function recordedPageEvidence(auditId: string, pageUrl?: string, db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma,
  committedGaps?: ModuleGap[]): Promise<RecordedPageEvidence[]> {
  // Project metadata, media references and observations in PostgreSQL. Summary
  // readers never transfer whole-document HTML, network traces or sitemap bodies.
  // Discovery reuses only the bounded native anchor section and its observed base.
  const tasksQuery = db.$queryRaw<Array<Pick<AuditExecutionTask, 'id' | 'workKind' | 'workState' | 'status' | 'workInput' | 'workResult'>>>`
    SELECT "id", "workKind", "workState", "status", "workInput",
      CASE WHEN "workKind" = 'browser' THEN jsonb_set("workResult", '{data}', jsonb_build_object(
        'pageId', "workResult"->'data'->'pageId', 'metadata', "workResult"->'data'->'metadata',
        'preview', "workResult"->'data'->'preview', 'metadataFailure', "workResult"->'data'->'metadataFailure',
        'snapshot', jsonb_build_object('desktopUrl', "workResult"->'data'->'snapshot'->'desktopUrl',
          'mobileUrl', "workResult"->'data'->'snapshot'->'mobileUrl',
          'desktopHttpStatus', "workResult"#>'{data,snapshot,desktopHttpStatus}',
          'publicSignInRedirect', "workResult"->'data'->'snapshot'->'publicSignInRedirect',
          'collectionRestrictions', "workResult"->'data'->'snapshot'->'collectionRestrictions',
          'renderedSearchSnapshot', CASE WHEN "workResult"->'data'->'snapshot'->'renderedSearchSnapshot' IS NOT NULL THEN jsonb_build_object(
            'finalUrl', "workResult"->'data'->'snapshot'->'renderedSearchSnapshot'->'finalUrl',
            'documentBaseUrl', "workResult"->'data'->'snapshot'->'renderedSearchSnapshot'->'documentBaseUrl',
            'sections', jsonb_build_object('links', "workResult"->'data'->'snapshot'->'renderedSearchSnapshot'->'sections'->'links')) ELSE NULL END,
          'renderedScope', "workResult"->'data'->'snapshot'->'renderedScope')))
      WHEN "workKind" = 'captures' THEN jsonb_set("workResult", '{data}', jsonb_build_object(
        'pageId', "workResult"->'data'->'pageId', 'snapshot', jsonb_build_object(
          'desktopUrl', "workResult"->'data'->'snapshot'->'desktopUrl', 'mobileUrl', "workResult"->'data'->'snapshot'->'mobileUrl')))
      WHEN "workKind" = 'http' THEN jsonb_set("workResult", '{data}', jsonb_build_object('metadata', "workResult"->'data'->'metadata',
        'metadataFailure', "workResult"->'data'->'metadataFailure', 'navigation', "workResult"->'data'->'navigation',
        'publicPreview', "workResult"->'data'->'publicPreview'))
      WHEN "workKind" = 'pagespeed' THEN jsonb_set(jsonb_set("workResult",
        '{data,desktop,raw}', '{}'::jsonb, false), '{data,mobile,raw}', '{}'::jsonb, false)
      WHEN "workKind" IN ('check', 'flow', 'journeys', 'cross-page', 'slow-replay', 'discovery')
        AND jsonb_typeof("workResult"->'data') = 'object' THEN jsonb_set("workResult", '{data}', '{}'::jsonb)
      WHEN "workKind" IN ('search-resources', 'keyboard', 'bindings', 'fixture-setup', 'automatic-accounts', 'finalize') THEN NULL
      ELSE "workResult" END AS "workResult"
    FROM "audit_execution_tasks" WHERE "auditId" = ${auditId}
      ${pageUrl ? Prisma.sql`AND "pageUrl" = ${pageUrl}` : Prisma.empty}
    ORDER BY "createdAt", "id" LIMIT ${MAX_TASKS_PER_AUDIT + 1}`
  const gapsQuery = committedGaps ?? recordedModuleGaps(auditId, db, pageUrl)
  const selection = pageUrl ? Prisma.sql`JOIN LATERAL (
    SELECT CASE WHEN jsonb_typeof(observed.findings) = 'array' THEN (
      SELECT jsonb_agg(flag.value ORDER BY flag.position) FROM jsonb_array_elements(observed.findings) WITH ORDINALITY flag(value, position)
      WHERE COALESCE(flag.value->>'pageUrl', observed."pageUrl") = ${pageUrl}
    ) WHEN observed."pageUrl" = ${pageUrl} THEN observed.findings END AS findings
  ) selected ON selected.findings IS NOT NULL` : Prisma.empty
  const findingsQuery = db.$queryRaw<Array<{ pageUrl: string | null; findings: unknown }>>`
    SELECT observed."pageUrl", ${pageUrl ? Prisma.sql`selected.findings` : Prisma.sql`observed.findings`} AS findings
    FROM (${recordedFindingArtifactsSql(auditId)}) observed ${selection}
    WHERE observed."workKind" IS DISTINCT FROM 'automatic-accounts'
    ORDER BY observed."createdAt", observed."id"`
  const [tasks, gaps, findings] = await Promise.all([tasksQuery, gapsQuery, findingsQuery])
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
  const findingsByPage = new Map<string, z.infer<typeof flagSchema>[]>()
  for (const row of findings) {
    for (const flag of z.array(flagSchema).max(500).parse(row.findings ?? [])) {
      const url = flag.pageUrl ?? row.pageUrl
      if (!url) continue
      const flags = findingsByPage.get(url)
      if (flags) flags.push(flag)
      else findingsByPage.set(url, [flag])
    }
  }
  const positions = [...new Set(tasks.flatMap(task => {
    const input = task.workInput as { position?: number } | null
    return typeof input?.position === 'number' ? [input.position] : []
  }))].sort((a, b) => a - b)
  const pages: RecordedPageEvidence[] = []
  for (const position of positions) {
    const pageTasks = tasks.filter(task => (task.workInput as { position?: number })?.position === position)
    for (const task of pageTasks) {
      if (task.workState === 'COMPLETED' && task.workResult && !(task.workInput as { verificationContexts?: unknown }).verificationContexts)
        readArtifact(task.workResult, task.workKind as TaskArtifact['kind'])
    }
    const find = (kind: string) => pageTasks.find(task => task.workKind === kind && task.workState === 'COMPLETED')
    const browserTask = pageTasks.find(task => task.workKind === 'browser' && task.workState === 'COMPLETED' &&
      (task.workInput as { device?: string })?.device !== 'mobile'), httpTask = find('http'), searchTask = pageTasks.find(task => task.workKind === 'search' && task.workState === 'COMPLETED' &&
      (!((task.workInput as { module?: string })?.module) || (task.workInput as { module?: string })?.module === 'summary')), judgeTask = find('judge')
    const identityTask = browserTask ?? find('browser')
    const collectedPageId = identityTask?.workResult ? z.string().min(1).parse(readArtifact(identityTask.workResult, 'browser').data.pageId) : ''
    const observedBrowser = browserTask?.workResult ? browserArtifactSchema.extend({ metadataFailure: browserArtifactSchema.shape.metadataFailure.nullish(), preview: pagePreviewSchema.nullish(), snapshot: screenshotSnapshotSchema.pick({
      desktopUrl: true, mobileUrl: true, renderedScope: true, desktopHttpStatus: true,
    }).extend({
      renderedScope: screenshotSnapshotSchema.shape.renderedScope.nullable(),
      publicSignInRedirect: screenshotSnapshotSchema.shape.publicSignInRedirect.nullish().transform(value => value ?? undefined),
      collectionRestrictions: screenshotSnapshotSchema.shape.collectionRestrictions.nullish(),
      renderedSearchSnapshot: renderedSearchSnapshotSchema.pick({ finalUrl: true, documentBaseUrl: true }).extend({
        finalUrl: renderedSearchSnapshotSchema.shape.finalUrl.nullish(),
        documentBaseUrl: renderedSearchSnapshotSchema.shape.documentBaseUrl.nullish(),
        sections: renderedSearchSnapshotSchema.shape.sections.pick({ links: true }),
      }).nullish(),
    }) }).parse(readArtifact(browserTask.workResult, 'browser').data) : null
    const browser = observedBrowser?.snapshot.desktopHttpStatus === 206 ? null : observedBrowser
    const captureTask = find('captures')
    const captures = captureTask?.workResult ? captureArtifactSchema.extend({ snapshot: screenshotSnapshotSchema.pick({ desktopUrl: true, mobileUrl: true }) }).parse(readArtifact(captureTask.workResult, 'captures').data) : null
    const response = httpTask?.workResult ? httpArtifactSchema.pick({ metadata: true }).extend({ metadataFailure: httpArtifactSchema.shape.metadataFailure.nullish(),
      navigation: httpArtifactSchema.shape.navigation.nullish(), publicPreview: httpArtifactSchema.shape.publicPreview.nullish() }).parse(readArtifact(httpTask.workResult, 'http').data) : null
    const metadata = browser?.metadata ?? response?.metadata
    const speed = readSettledPageSpeedEvidence(pageTasks)
    const search = searchTask?.workResult ? searchArtifactSchema.parse(readArtifact(searchTask.workResult, 'search').data) : null
    const judgeArtifact = judgeTask?.workResult ? readArtifact(judgeTask.workResult, 'judge') : null
    const judged = judgeArtifact ? judgeSchema.parse(judgeArtifact.data) : null
    const triage = judged?.triage && judgeTask && judgeArtifact ? { ...judged.triage,
      output: { ...judged.triage.output, newFlags: judged.triage.output.newFlags.map(flag => admitAiObservation(flag, {
        auditId, taskId: judgeTask.id, collectedAt: judgeArtifact.collectedAt,
      })) } } : undefined
    const url = (pageTasks[0].workInput as { pageUrl: string }).pageUrl
    const flags = findingsByPage.get(url) ?? []
    pages.push({ pageId: collectedPageId, url, metadata: metadata ?? null, primary: (pageTasks[0].workInput as { primary?: boolean }).primary === true,
      preview: browser?.preview ?? undefined, publicPreview: response?.publicPreview ?? undefined, desktop: speed?.desktop ?? null, mobile: speed?.mobile ?? null,
      navigation: capturedPageLinks(browser?.snapshot, browser?.metadata ?? null) ?? capturedPageLinks({
        collectionRestrictions: browser?.snapshot.collectionRestrictions,
      }, response?.metadata ?? null) ?? (response?.navigation ? { ...response.navigation,
        complete: response.navigation.complete && !documentEvidenceWithheld(browser?.snapshot.collectionRestrictions) } : null),
      renderedScope: browser?.snapshot.renderedScope ?? undefined,
      desktopError: speed?.desktopError, mobileError: speed?.mobileError,
      desktopScreenshot: Boolean(captures?.snapshot.desktopUrl ?? browser?.snapshot.desktopUrl), mobileScreenshot: Boolean(captures?.snapshot.mobileUrl ?? browser?.snapshot.mobileUrl),
      desktopBase64: '', mobileBase64: null, flowScan: pageTasks.some(task => task.workKind === 'flow' && task.workState === 'COMPLETED' &&
        (task.workInput as { module?: string })?.module !== 'form-validation'),
      flags, failedModules: [...new Set([
        ...(browser?.metadataFailure || response?.metadataFailure ? ['metadata'] : []),
        ...(triage?.assessment?.status === 'PARTIAL' ? ['page-triage-evaluation'] : []),
        ...pageTasks.filter(task => task.status !== 'NOT_APPLICABLE' && ['BLOCKED', 'EXHAUSTED'].includes(task.workState ?? '')).map(task =>
          (task.workInput as { module?: string })?.module ?? task.workKind ?? 'unknown'),
        ...gaps.filter(gap => gap.pageUrl === url).map(gap => gap.targetKey.slice('module:'.length)),
      ])],
      triage, triageFailure: judged?.triageFailure, searchReceipt: search?.receipt,
      detectedTech: [], industryGuess: null })
  }
  return pages
}

/** Whole-page review consumers retain their metadata requirement. Independent
 * observations use recordedPageEvidence and never lose a page at this adapter. */
export async function recordedPages(auditId: string, pageUrl?: string, db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma): Promise<PageRun[]> {
  return (await recordedPageEvidence(auditId, pageUrl, db)).filter((page): page is RecordedPageEvidence & { metadata: PageRun['metadata'] } => page.metadata !== null)
}


function prescriptionArtifact(usage: PrescriptionRunUsage) {
  const measured = usage.inputTokens > 0 || usage.outputTokens > 0 || usage.cacheReadTokens > 0 || usage.cacheWriteTokens > 0 || usage.model.length > 0
  if (!measured) return { completed: true as const }
  return prescriptionResultSchema.parse({
    completed: true,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    ...(usage.model ? { model: usage.model.slice(0, 200) } : {}),
  })
}

export const lifecycleHandlers: TaskHandler[] = [
  { kind: 'prescription', replay: 'idempotent', timeoutMs: 90_000,
    validateResult: artifact => { prescriptionResultSchema.parse(artifact.data) },
    async evaluate(context) {
      let usage: PrescriptionRunUsage = { inputTokens: 0, outputTokens: 0, model: '', cacheReadTokens: 0, cacheWriteTokens: 0 }
      if (!context.input.prescriptionScope) throw new TaskFailure('PRESCRIPTION_SCOPE_MISSING', false)
      try { usage = await runAiReview(context.audit.id, context.deadline, context.input.prescriptionFlagKeys, context.input.prescriptionScope) }
      catch (error) {
        if (error instanceof PrescriptionScopeChanged) throw new TaskFailure('PRESCRIPTION_SCOPE_CHANGED', false)
        if (error instanceof JudgeContractError) throw new TaskFailure('AI_CONTRACT_INVALID', false)
        throw error
      }
      return serializeArtifact('prescription', prescriptionArtifact(usage))
    },
  },
  { kind: 'fixture-setup', replay: 'protected', timeoutMs: 70_000,
    validateResult: artifact => { safeFormExecutionResultSchema.parse(artifact.data) },
    async reconcile(context) {
      const setup = readExecutionSpec(context.audit.executionSpec)?.fixtureSetup
      return Boolean(setup && context.audit.projectId && await reconcileSafeFixtureCleanup({
        projectId: context.audit.projectId, fixtureId: setup.id, version: setup.version,
        requireAuthorization: false,
      }))
    },
    async evaluate(context) {
      const spec = readExecutionSpec(context.audit.executionSpec), setup = spec?.fixtureSetup
      if (spec?.scope !== 'FIXTURE_SETUP' || !setup || setup.id !== context.input.fixtureId || !context.audit.projectId)
        throw new TaskFailure('FIXTURE_SETUP_INTENT_INVALID', false)
      const result = await executeSafeFormFixture({ projectId: context.audit.projectId, fixtureId: setup.id,
        expectedVersion: setup.version, startUrl: spec.targetUrl, allowLocalhost: false, requireAuthorization: false,
        deadline: context.deadline })
      return serializeArtifact('fixture-setup', safeFormExecutionResultSchema.parse(result))
    },
    async commit(context, artifact, tx) {
      const setup = readExecutionSpec(context.audit.executionSpec)!.fixtureSetup!
      const result = safeFormExecutionResultSchema.parse(artifact.data)
      await tx.outcomeFixture.updateMany({ where: { id: setup.id, projectId: context.audit.projectId!, configuredByUserId: context.audit.userId, version: setup.version },
        data: { lastDryRunVersion: setup.version, lastDryRunAt: new Date(artifact.collectedAt), lastDryRunResult: result, authorizedAt: null } })
    },
  },
  { kind: 'discovery', replay: 'read_only', timeoutMs: 45_000, continuation: true,
    validateResult: artifact => { discoverySchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const start = observationBatchStart(context, artifact, DISCOVERY_BATCH_SIZE)
      const committed = start === null ? artifact : await commitObservation(context, artifact, tx, (context.input.module ?? 'first') + ':batch:' + start)
      const result = discoverySchema.parse(artifact.data)
      for (const receipt of result.receipts ?? []) await commitCheckReceipt(context, receipt, tx,
        ':public-links:' + (context.input.module ?? 'first') + (start === null ? '' : ':batch:' + start))
      await commitFindings(context, committed, tx)
      return committed
    },
    async evaluate(context) {
      const spec = readExecutionSpec(context.audit.executionSpec)
      if (!spec) throw new TaskFailure('EXECUTION_SPEC_INVALID', false)
      const previous = context.task.workResult == null ? null : discoverySchema.parse(readArtifact(context.task.workResult, 'discovery').data)
      const depth = asReviewDepth(spec.reviewDepth ?? context.audit.reviewDepth)
      const firstPassCanBeReused = spec.scope === 'SITE' && depth === 3 && context.input.module !== 'second'
      let reviewPages = previous?.pages ?? [], truncated = previous?.truncated ?? false
      const batch = await nextObservationBatch(context, 'discovery', discoveryMemberSchema, async () => {
        const pages = await recordedPageEvidence(context.audit.id), primary = pages.find(page => page.primary && page.url === spec.targetUrl)
        const history = context.audit.projectId ? { projectId: context.audit.projectId, environment: spec.environment, excludeAuditId: context.audit.id } : undefined
        if (spec.scope === 'CATEGORY' && spec.category) {
          // Recheck public destinations from the frozen page inventory without
          // promoting newly linked destinations into browser or evaluator work.
          const sources = spec.category.pages.map(url => ({ url, navigation: pages.find(page => page.url === url)?.navigation ?? null }))
          const cohort = await planRecordedDiscoveryObservations({ origin: spec.targetUrl, ceiling: openCheckCeilingForDepth(depth), sources,
            urls: sources.flatMap(source => source.navigation ? publicLinkUrls(source.url, source.navigation) : []) }, history)
          reviewPages = spec.category.pages
          truncated = cohort.truncated
          return cohort.members
        }
        const secondPass = context.input.module === 'second'
        const existing = await loadTaskGraph(context.audit.id)
        const allPlans: TaskPlan[] = existing.map(task => ({ kind: task.workKind as TaskPlan['kind'], key: task.targetKey.slice(5),
          scope: task.scopeKey, input: task.workInput as TaskPlan['input'], dependencies: task.workDependencies }))
        const sourceKeys = new Set(context.task.workDependencies)
        // Even if expansion committed before this task was interrupted, only
        // its original dependency pages can supply second-hop declarations.
        const sourceUrls = new Set(allPlans.filter(task => sourceKeys.has(task.key) && ['browser', 'http'].includes(task.kind))
          .map(task => task.input.pageUrl))
        const linkedSources = secondPass ? pages.filter(page => page !== primary && sourceUrls.has(page.url)) : []
        const sources = primary ? [primary, ...linkedSources] : linkedSources
        const admitted = secondPass ? allPlans.filter(task => task.kind === 'browser')
          .sort((left, right) => left.input.position - right.input.position).map(task => task.input.pageUrl) : spec.monitoringPages
        const plan = planReviewTargets({ pastedUrl: spec.targetUrl, depth, discoveryPass: secondPass ? 'second' : 'first',
          pastedLinks: primary?.navigation ? resolvedPageLinks(primary.url, primary.navigation) : [], retainedUrls: admitted,
          linkedPageLinks: linkedSources.map(page => ({ pageUrl: page.url, links: page.navigation ? resolvedPageLinks(page.url, page.navigation) : [] })) })
        const known = new Set(existing.filter(task => task.workKind === 'browser').map(task => task.pageUrl ? navigationDestinationKey(task.pageUrl) : null))
        let nextPosition = Math.max(-1, ...allPlans.map(task => task.input.position)) + 1
        for (const url of plan.reviewUrls) if (!known.has(navigationDestinationKey(url)) && nextPosition < INTERNAL_REVIEW_PAGE_CEILING) {
          allPlans.push(...pageTaskPlan({ pageUrl: url, primary: false, position: nextPosition++, role: 'linked' }, spec))
          known.add(navigationDestinationKey(url))
        }
        if (depth === 3 && !secondPass && !allPlans.some(task => task.key === 'discovery:second')) allPlans.push({ kind: 'discovery', key: 'discovery:second', scope: 'site:second',
          input: { ...context.input, module: 'second' }, dependencies: ['discovery', ...allPlans.filter(task => task.input.position > 0 && ['browser', 'http'].includes(task.kind)).map(task => task.key)] })
        for (const task of allPlans) {
          if (task.kind === 'cross-page') task.dependencies = allPlans.filter(item => ['discovery', 'search'].includes(item.kind)).map(item => item.key)
          if (task.kind === 'finalize') task.dependencies = allPlans.filter(item => item.kind !== 'finalize').map(item => item.key)
        }
        // Extend summary dependencies before this discovery checkpoint becomes settled.
        await persistTaskPlan(context.audit.id, allPlans)
        const previousResponses = secondPass ? await previousDiscoveryResponses(context.audit.id, context.input.pageUrl) : undefined
        const cohort = await planRecordedDiscoveryObservations({ origin: spec.targetUrl, urls: plan.openCheckUrls,
          ceiling: openCheckCeilingForDepth(depth), sources, previousResponses }, history)
        reviewPages = plan.reviewUrls
        truncated = plan.truncated || cohort.truncated || !primary?.navigation
        return cohort.members
      }, DISCOVERY_BATCH_SIZE)
      const destinations = batch.members.filter(member => member.kind === 'destination').filter(member => !member.reused)
      const extendedBody = new Set(destinations.filter(member => member.extendedBody).map(member => member.url))
      const opened = await openCheckDestinations(destinations.map(member => member.url),
        { origin: spec.targetUrl, ceiling: DISCOVERY_BATCH_SIZE, deadline: context.deadline, extendedBody })
      const execution = checkExecution(context, 'seo', 'http')
      const observations = discoveryObservations(batch.members, opened.results, execution)
      return observationArtifact('discovery', discoverySchema.parse({ pages: reviewPages,
        openCheckCount: (previous?.openCheckCount ?? 0) + opened.results.length, truncated,
        ...(firstPassCanBeReused ? { responses: discoveryResponses(opened.results, extendedBody), responseCollectedAt: execution.collectedAt } : {}),
        flags: observations.flatMap(result => result.flags), receipts: observations.map(result => result.receipt) }), batch.progress)
    },
  },
  { kind: 'cross-page', replay: 'read_only', timeoutMs: 12_000,
    validateResult: artifact => { crossPageSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      for (const receipt of crossPageSchema.parse(artifact.data).receipts ?? []) await commitCheckReceipt(context, receipt, tx)
      await commitFindings(context, artifact, tx)
    },
    async evaluate(context) {
      const spec = readExecutionSpec(context.audit.executionSpec)
      const selected = Object.entries(spec?.checks ?? {}).filter(([id]) => CHECK_REGISTRY[id]?.module === 'corridor')
      const source = corridorEvidenceSource(spec?.checks)
      if (selected.some(([id, version]) => CHECK_REGISTRY[id].version - (source === 'http' ? 0 : 1) !== version))
        throw new TaskFailure('CHECK_VERSION_UNAVAILABLE', false)
      const pages = await recordedPageEvidence(context.audit.id)
      const search = await runCheckedPageSearch(pages.flatMap(page => page.searchReceipt ? [page.searchReceipt] : []))
      const comparison = source === 'http' ? publicPagePreviewForComparison : pagePreviewForComparison
      const corridor = evaluateCorridorConsistency(selected.length ? pages.map(page => comparison(page, page.primary ? 'primary' : 'linked')) : [], source)
      const receipts = [...corridor.assertions].map(([pageUrl, assertions]) => checkReceiptSchema.parse({
        kind: 'site-module-check', version: 1, module: 'corridor', pageUrl, applicable: assertions.some(assertion => assertion.disposition !== 'observed'),
        complete: assertions.every(assertion => assertion.complete), passed: assertions.every(assertion => assertion.complete && (assertion.disposition === 'observed' || assertion.passed)), assertions,
        execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: CHECK_MODULES.corridor.version,
          checkVersions: Object.fromEntries(selected), source, collectedAt: new Date().toISOString() },
      }))
      return serializeArtifact('cross-page', crossPageSchema.parse({ flags: [...search, ...corridor.flags], receipts }))
    },
  },
  { kind: 'bindings', replay: 'protected', timeoutMs: 90_000,
    validateResult: artifact => { bindingSchema.parse(artifact.data) },
    async reconcile(context) {
      const spec = readExecutionSpec(context.audit.executionSpec)
      const binding = spec?.outcomes.find(outcome => outcome.id === context.input.outcomeId)?.bindings.find(item => item.key === context.input.bindingKey)
      if (!binding) return false
      if (binding.mechanism !== 'SAFE_FORM') return true
      if (!binding.fixture || !context.audit.projectId) return false
      const saved = await prisma.outcomeBindingExecution.findUnique({ where: { auditId_outcomeId_bindingKey: {
        auditId: context.audit.id, outcomeId: context.input.outcomeId!, bindingKey: binding.key } }, select: { id: true } })
      return Boolean(saved) || reconcileSafeFixtureCleanup({ projectId: context.audit.projectId,
        fixtureId: binding.fixture.id, version: binding.fixture.version })
    },
    async evaluate(context) {
      if (!context.input.outcomeId || !context.input.bindingKey) throw new TaskFailure('BINDING_INTENT_INVALID', false)
      const executed = await runBoundOutcomeExecutions(context.audit.id, { outcomeId: context.input.outcomeId, bindingKey: context.input.bindingKey })
      return serializeArtifact('bindings', bindingSchema.parse({ executed, outcomeId: context.input.outcomeId, bindingKey: context.input.bindingKey }))
    },
  },
  { kind: 'journeys', replay: 'read_only', timeoutMs: 60_000, continuation: true,
    validateResult: artifact => { journeySchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const start = observationBatchStart(context, artifact, 1)
      const committed = start === null ? artifact : await commitObservation(context, artifact, tx, 'batch:' + start)
      for (const receipt of journeySchema.parse(artifact.data).overlayReceipts ?? []) await commitCheckReceipt(context, receipt, tx, overlayReceiptScope(receipt))
      for (const receipt of journeySchema.parse(artifact.data).pageReceipts ?? []) await commitCheckReceipt(context, receipt, tx, journeyReceiptScope(receipt))
      await commitFindings(context, committed, tx)
      const rows = await tx.journeyFinding.findMany({ where: { journeyReview: { auditId: context.audit.id }, flagId: null,
        OR: [{ checkId: { in: ['overlay-blocks-nav', 'overlay-blocks-cta', 'overlay-blocks-form', ...Object.values(JOURNEY_ASSERTIONS).flat()] } },
          { checkId: { endsWith: '-hidden-cta' } }, { checkId: { endsWith: '-dead-end' } }] }, take: 500, select: { id: true, checkId: true, url: true, journeyReview: { select: { startUrl: true } } } })
      for (const row of rows) {
        const flag = await tx.flag.findFirst({ where: { auditId: context.audit.id, checkId: durableCheckId(row.checkId),
          OR: [{ pageUrl: row.journeyReview.startUrl }, { affectedPaths: { array_contains: row.journeyReview.startUrl } }] }, select: { id: true } })
        if (flag) await tx.journeyFinding.update({ where: { id: row.id }, data: { flagId: flag.id } })
      }
      return committed
    },
    async evaluate(context) {
      // Classification enriches selection. Native journeys collect their own
      // page evidence and must survive an unavailable whole-document parser.
      const metadata = browserEvidence(context)?.metadata ?? null
      const spec = readExecutionSpec(context.audit.executionSpec), target = spec?.verificationTarget
      const phases = spec?.verificationScopes?.find(scope => scope.pageUrl === context.input.pageUrl)?.overlayPhases?.filter(phase => phase.startsWith('journey_'))
      const sources = target?.kind === 'DIAGNOSTIC' ? await readDiagnosticSources(prisma, spec, context.audit.projectId) : []
      const expected = sources.flatMap(flag => scopedOverlayRule(flag.verificationRule) && Array.isArray(flag.evidenceTargets) ? flag.evidenceTargets.flatMap(value => {
        const parsed = z.object({ context: z.string(), selector: z.string(), label: z.string() }).safeParse(value)
        if (!parsed.success || !parsed.data.context.startsWith('overlay:' + capturePageKey(context.input.pageUrl) + ':') || !phases?.includes(parsed.data.context.split(':')[3])) return []
        const scoped = overlayTargetSchema.safeParse({ ...parsed.data, kind: parsed.data.context.split(':')[4] })
        return scoped.success ? [scoped.data] : []
      }) : [])
      const journeyTarget = target?.kind === 'DIAGNOSTIC' && Object.values(JOURNEY_ASSERTIONS).flat().some(checkId => checkId === target.checkId)
      const batch = await nextObservationBatch(context, 'journeys', journeyRunSchema, async () => {
        const conditions = target?.kind === 'DIAGNOSTIC' ? originalJourneyConditions(sources, context.input.pageUrl)
        : context.audit.projectId && spec ? await loadRecordedJourneyConditions({ projectId: context.audit.projectId,
          environment: spec.environment, pageUrl: context.input.pageUrl, excludeAuditId: context.audit.id }) : []
        return selectJourneyRuns(parseProductContract(context.audit.productContract), metadata ? detectPagePurpose(metadata, context.input.pageUrl).purpose : null,
          { ...(phases?.length ? { overlayPhases: phases } : {}),
            ...(journeyTarget ? { expectedJourneyConditions: conditions } : conditions.length ? { recordedJourneyConditions: conditions } : {}) })
      }, 1)
      const observations: OverlayObservation[] = []
      const assessments: JourneyAssessment[] = []
      const pages: JourneyObservation[] = [], findings: JourneyFindingDraft[] = []
      const findingCount = await runJourneyReviewsForAudit(context.audit.id, context.input.pageUrl,
        { included: true, deadline: context.deadline, metadata, scanAccess: await resolveAuditScanAccess(context.audit.id),
          journeyRuns: batch.members, journeyPageOnly: journeyTarget,
          completeReview: !batch.progress || batch.progress.completed === observationTotal(batch.progress),
          ...(spec ? { allowedCheckIds: Object.keys(spec.checks) } : {}),
          ...(phases?.length ? { overlayPhases: phases, overlayExpectedTargets: expected, allowedCheckIds: Object.keys(spec!.checks) } : {}),
          onAssessment: assessment => assessments.push(assessment),
          onOverlayObservations: found => observations.push(...found),
          onPageObservations: found => pages.push(...found), onJourneyFindings: found => findings.push(...found) })
      return observationArtifact('journeys', journeySchema.parse({ findingCount, assessments,
        flags: [...observations.flatMap(runObservedOverlayChecks), ...nativeJourneyFlags(findings)],
        pageReceipts: journeyReceipts(pages, checkExecution(context, 'journeys', 'rendered-dom')),
        overlayReceipts: overlayCheckReceipts(observations, checkExecution(context, 'overlays', 'rendered-dom')) }), batch.progress)
    },
  },
  { kind: 'judge', replay: 'read_only', timeoutMs: 75_000,
    validateResult: artifact => { judgeSchema.parse(artifact.data) },
    async evaluate(context) {
      const page = (await recordedPages(context.audit.id, context.input.pageUrl)).find(item => item.url === context.input.pageUrl)
      if (!page?.pageId) throw new TaskFailure('EXPLANATION_PAGE_UNAVAILABLE', false)
      const captures = captureEvidence(context) ?? browserEvidence(context)
      async function capture(url: string | null | undefined, device: string) {
        if (!url) return null
        const pageKey = new URL(url).searchParams.get('page')
        const bytes = await readScreenshot(context.audit.id, device, pageKey, { deadline: context.deadline })
        return bytes?.toString('base64') ?? null
      }
      const desktop = await capture(captures?.snapshot.desktopUrl, 'desktop'), mobile = await capture(captures?.snapshot.mobileUrl, 'mobile')
      const result = await judgePageStage(await pipelineContext(context), { pageId: page.pageId, url: page.url,
        metadata: page.metadata, desktop: currentPageSpeedLab(page, 'desktop'), mobile: currentPageSpeedLab(page, 'mobile'), flags: page.flags,
        desktopBase64: desktop ?? '', mobileBase64: mobile, completeness: page.failedModules.length ? 'PARTIAL' : 'FULL',
        observationScope: page.renderedScope })
      return serializeArtifact('judge', judgeSchema.parse(result.artifact ?? {}))
    },
  },
  { kind: 'finalize', replay: 'idempotent', timeoutMs: 90_000,
    validateResult: artifact => { finalSchema.parse(artifact.data) },
    async evaluate(context) {
      const latest = await prisma.audit.findUniqueOrThrow({ where: { id: context.audit.id }, select: { id: true, status: true, parentId: true,
        reportCompleteness: true, executionSpec: true, completedAt: true, startedAt: true, createdAt: true, url: true, siteId: true } })
      if (latest.status === 'COMPLETED') {
        await executionWrite(tx => settleRecordedPages(tx, latest.id))
        await persistImprovementCycle(latest.id, latest.parentId)
        if (!latest.siteId && readExecutionSpec(latest.executionSpec)?.scope === 'SITE') {
          await persistAuditGraphSnapshot(latest.id).catch(error => logger.error('Knowledge-graph persist failed after resuming finalization', error))
        }
        await scheduleOptionalAiReview(latest.id)
        return serializeArtifact('finalize', { status: 'COMPLETED', partial: latest.reportCompleteness !== 'FULL' })
      }
      const tasks = await loadTaskGraph(latest.id)
      const failed = tasks.filter(task => task.status !== 'NOT_APPLICABLE' && ['BLOCKED', 'EXHAUSTED'].includes(task.workState ?? '')).map(task => task.workKind ?? 'unknown')
      const journeyAssessments = await prisma.$queryRaw<Array<{ assessments: unknown }>>`
        SELECT "workResult"->'data'->'assessments' AS assessments FROM audit_execution_tasks
        WHERE "auditId" = ${latest.id} AND "workKind" = 'journeys' AND "workState" = 'COMPLETED'
          AND "workResult"->'data' ? 'assessments'
        UNION ALL SELECT detail->'data'->'assessments' FROM audit_verifier_executions
        WHERE "auditId" = ${latest.id} AND "targetKey" IN (${Prisma.join(OBSERVATION_TARGETS)}) AND status = 'COMPLETED'
          AND detail->>'kind' = 'journeys' AND detail->'data' ? 'assessments'`
      if (journeyAssessments.some(row => hasIncompleteJourneyAssessment({ data: { assessments: row.assessments } }))) failed.push('journey-evaluation')
      const incomplete = await recordedModuleGaps(latest.id, prisma)
      failed.push(...incomplete.map(receipt => receipt.targetKey.slice('module:'.length)))
      await executionWrite(tx => settleRecordedPages(tx, latest.id))
      const spec = readExecutionSpec(latest.executionSpec)
      if (spec && spec.scope !== 'SITE' && spec.scope !== 'CATEGORY') {
        // A configured action does not need an unrelated page scan, screenshot,
        // PageSpeed measurement or AI explanation to complete its own assessment.
        await persistAuditRunCost(latest.id, { durationMs: Date.now() - (latest.startedAt ?? latest.createdAt).getTime(),
          llmInputTokens: 0, llmOutputTokens: 0, llmModel: 'none', pagespeedCalls: 0, pagesReviewed: 0 })
        await executionWrite(tx => tx.audit.update({ where: { id: latest.id }, data: {
          status: 'COMPLETED', progress: 100, verdict: null,
          reportCompleteness: failed.length ? 'PARTIAL' : 'FULL', failedModules: failed,
          evidenceCoverage: { version: 1, scope: spec.scope, outcomeIds: spec.outcomes.map(outcome => outcome.id),
            verificationTarget: spec.verificationTarget },
          completedAt: latest.completedAt ?? new Date(), finalizedAt: new Date(), failureCode: null, errorMsg: null,
        } }))
        await persistImprovementCycle(latest.id, latest.parentId)
        return serializeArtifact('finalize', { status: 'COMPLETED', partial: failed.length > 0 })
      }
      const discoveryTasks = tasks.filter(task => task.workKind === 'discovery' && task.status !== 'NOT_APPLICABLE').length
      const [pages, ctx, discovery] = await Promise.all([
        recordedPageEvidence(latest.id, undefined, prisma, incomplete), pipelineContext(context), recordedDiscoveryCoverage(latest.id, discoveryTasks),
      ])
      if (discovery.partial && !failed.includes('discovery')) failed.push('discovery')
      ctx.openCheckCount = discovery.openCheckCount
      failed.push(...pages.flatMap(page => page.failedModules).filter(module => !failed.includes(module)))
      const accountTask = await prisma.auditExecutionTask.findFirst({ where: { auditId: latest.id, workKind: 'automatic-accounts', workState: 'COMPLETED' }, select: { workResult: true } })
      if (accountTask?.workResult && pages[0]) {
        const accountFlags = z.array(flagSchema).parse(readArtifact(accountTask.workResult, 'automatic-accounts').data.flags ?? [])
        pages[0].flags.push(...accountFlags)
      }
      if (spec?.category) {
        const missingPages = spec.category.pages.filter(url => !pages.some(page => page.url === url))
        if (missingPages.length) failed.push('category-pages')
        if (pages.some(page => page.searchReceipt?.complete === false)) failed.push('search')
        const recordedFlags = await recordedTaskFindings(latest.id, prisma, latest.executionSpec)
        await persistDeterministicFlags(latest.id, recordedFlags, { MESSAGE: null, EXPERIENCE: null, REACH: null },
          undefined, { authoritativeProjection: true })
        await persistAuditRunCost(latest.id, { durationMs: Date.now() - (latest.startedAt ?? latest.createdAt).getTime(),
          llmInputTokens: 0, llmOutputTokens: 0, llmModel: 'none',
          pagespeedCalls: pages.reduce((count, page) => count + Number(Boolean(page.desktop)) + Number(Boolean(page.mobile)), 0),
          pagesReviewed: pages.length, openCheckRequests: discovery.openCheckCount })
        await executionWrite(async tx => {
          await tx.audit.update({ where: { id: latest.id }, data: {
            status: 'COMPLETED', progress: 100, verdict: null,
            reportCompleteness: failed.length ? 'PARTIAL' : 'FULL', failedModules: [...new Set(failed)],
            ...(discoveryTasks ? { reviewCoverage: buildReviewCoverage({ reviewedPageCount: pages.length,
              openCheckCount: discovery.openCheckCount, partial: failed.length > 0 }) } : {}),
            evidenceCoverage: { version: 1, scope: 'CATEGORY', area: spec.category!.area,
              metadata: pages.length === spec.category!.pages.length && pages.every(page => Boolean(page.metadata)),
              desktopPageSpeed: pages.length > 0 && pages.every(page => currentPageSpeedLab(page, 'desktop') !== null),
              mobilePageSpeed: pages.length > 0 && pages.every(page => currentPageSpeedLab(page, 'mobile') !== null),
              flowScan: pages.length > 0 && pages.every(page => page.flowScan), aiAssessment: false },
            completedAt: latest.completedAt ?? new Date(), finalizedAt: new Date(), failureCode: null, errorMsg: null,
          } })
        })
        await persistImprovementCycle(latest.id, latest.parentId)
        return serializeArtifact('finalize', { status: 'COMPLETED', partial: failed.length > 0 })
      }
      if (pages.some(page => page.searchReceipt?.complete === false)) failed.push('search')
      ctx.pagespeedCalls = pages.reduce((count, page) => count + Number(Boolean(page.desktop)) + Number(Boolean(page.mobile)), 0)
      for (const page of pages) if (page.triage) {
        ctx.usage.inputTokens += page.triage.usage.inputTokens; ctx.usage.outputTokens += page.triage.usage.outputTokens
        ctx.usage.models.push(page.triage.usage.model)
      }
      await executionWrite(tx => tx.audit.update({ where: { id: latest.id }, data: { status: 'FINALIZING',
        reviewCoverage: buildReviewCoverage({ reviewedPageCount: pages.length, openCheckCount: discovery.openCheckCount, partial: failed.length > 0 }),
        failedModules: failed } }))
      const recordedFlags = await recordedTaskFindings(latest.id, prisma, latest.executionSpec)
      await persistDeterministicFlags(latest.id, recordedFlags, productScoresFromFlags(pages, recordedFlags),
        undefined, { authoritativeProjection: true })
      if (pages.length) await finalizeFromOutcome({ ctx, auditId: latest.id, auditUrl: latest.url, pageRuns: pages, startedAt: ctx.startedAt,
        captureAdditionalEvidence: false, recordedFlags, failedModules: failed })
      else await finalizeTriageDegraded({ auditId: latest.id, durationMs: Date.now() - ctx.startedAt.getTime(), pagespeedCalls: 0,
        openCheckRequests: discovery.openCheckCount,
        evidence: { desktopScreenshot: false, mobileScreenshot: false, metadata: false, desktopPageSpeed: false, mobilePageSpeed: false },
        reason: 'unknown', errorMsg: 'Collection finished without enough page evidence to establish a verdict.' })
      await scheduleOptionalAiReview(latest.id)
      return serializeArtifact('finalize', { status: 'COMPLETED', partial: failed.length > 0 || !pages.length || pages.some(page => !page.triage) })
    },
  },
]
