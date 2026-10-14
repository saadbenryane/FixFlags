import { Prisma, type AuditVerifierExecution } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { executionWrite } from '../execution-ownership'
import { loadTaskGraph, persistTaskPlan } from './engine'
import { serializeArtifact, readArtifact, TaskFailure, type TaskPlan, type TaskArtifact, MAX_TASKS_PER_AUDIT } from './contracts'
import { pageTaskPlan } from './graph'
import { browserArtifactSchema, captureArtifactSchema, httpArtifactSchema, speedArtifactSchema, screenshotSnapshotSchema } from './snapshots'
import { browserEvidence, captureEvidence, searchArtifactSchema } from './evaluators'
import { flagSchema, commitFindings } from './results'
import { asReviewDepth, planReviewTargets, openCheckCeilingForDepth, buildReviewCoverage } from '../review-depth'
import { openCheckDestinations } from '../open-check'
import { canonicalizeDestination } from '../url-identity'
import { publicLinkObservations, publicLinkUrls, resolvedPageLinks } from '../checks/public-links'
import { checkReceiptSchema } from '../checks/receipt'
import { commitCheckReceipt } from './results'
import { overlayCheckReceipts, overlayReceiptScope, overlayTargetSchema, scopedOverlayRule, runObservedOverlayChecks, type OverlayObservation } from '../checks/overlay-evidence'
import { capturePageKey } from '../browser/observation-scope'
import { JOURNEY_ASSERTIONS, JOURNEY_VERIFICATION_RULE, journeyReceipts, journeyReceiptScope, nativeJourneyFlags, readJourneyContext, type JourneyObservation } from '../checks/journey-evidence'
import type { JourneyFindingDraft } from '../journey/types'
import { durableCheckId } from '../flag-identity'
import { runCheckedPageSearch } from '../search/workflow'
import { evaluateCorridorConsistency } from '../checks/corridor-consistency'
import { runBoundOutcomeExecutions } from '@/lib/sites/application/checkout-execution'
import { reconcileSafeFixtureCleanup, executeSafeFormFixture, safeFormExecutionResultSchema } from '@/lib/sites/application/safe-form-executor'
import { runJourneyReviewsForAudit } from '../journey/run-journey-reviews'
import { resolveAuditScanAccess } from '../scan-access-store'
import { systemClock } from '@/lib/time/clock'
import { createPipelineEventSink } from '../pipeline-log'
import { judgePageStage } from '../pipeline/stages/judge-page'
import { triageOutputSchema } from '../judge-triage-schema'
import { finalizeFromOutcome } from '../pipeline/finalize-from-outcome'
import { finalizeTriageDegraded, persistImprovementCycle } from '../finalize'
import { persistDeterministicFlags } from '../persist'
import { productScoresFromFlags } from '../pipeline/combine-pages'
import { readScreenshot } from '@/lib/storage/screenshots'
import type { PageRun, PipelineContext } from '../pipeline/types'
import type { TaskContext, TaskHandler } from './registry'
import { persistAuditRunCost } from '@/lib/billing/costs'

const findingsSchema = z.object({ flags: z.array(flagSchema).max(500) }).strict()
const crossPageSchema = findingsSchema.extend({ receipts: z.array(checkReceiptSchema).max(24).optional() }).strict()
const discoverySchema = z.object({ flags: z.array(flagSchema).max(500),
  pages: z.array(z.string().url()).max(24), openCheckCount: z.number().int().nonnegative().max(120), truncated: z.boolean(),
  receipts: z.array(checkReceiptSchema).max(24).optional() }).strict()
const bindingSchema = z.object({ executed: z.boolean(), outcomeId: z.string(), bindingKey: z.string() }).strict()
const journeySchema = z.object({ findingCount: z.number().int().nonnegative(), flags: z.array(flagSchema).max(500).optional(), overlayReceipts: z.array(checkReceiptSchema).max(100).optional(), pageReceipts: z.array(checkReceiptSchema).max(100).optional() }).strict()
const usageSchema = z.object({ inputTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative(), model: z.string(),
  cacheReadTokens: z.number().nonnegative().optional(), cacheWriteTokens: z.number().nonnegative().optional() }).strict()
const judgeSchema = z.object({ triage: z.object({ output: triageOutputSchema, usage: usageSchema }).strict().optional(),
  triageFailure: z.object({ reason: z.enum(['no_provider_keys', 'deadline_exhausted', 'provider_exhausted', 'contract_invalid', 'unknown']),
    message: z.string(), retryable: z.boolean() }).strict().optional() }).strict()
const finalSchema = z.object({ status: z.literal('COMPLETED'), partial: z.boolean() }).strict()

async function pipelineContext(context: TaskContext): Promise<PipelineContext> {
  const trace = { executionId: context.task.id, traceId: context.audit.id, attempt: context.task.workAttempts }
  return { auditId: context.audit.id, deadline: context.deadline, startedAt: context.audit.startedAt ?? context.audit.createdAt,
    clock: systemClock, trace, events: createPipelineEventSink(context.audit.id, trace, systemClock),
    pagespeedCalls: 0, usage: { inputTokens: 0, outputTokens: 0, models: [] }, includeAi: context.audit.includeAi,
    scanAccess: await resolveAuditScanAccess(context.audit.id) }
}

/** All scope is recovered from admitted tasks and their committed collectors, never
 * rediscovered during finalization. Missing input remains missing. */
export async function recordedPages(auditId: string, pageUrl?: string, db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma): Promise<PageRun[]> {
  // Project metadata, media references and observations in PostgreSQL. Summary
  // readers never transfer collected HTML, network traces or sitemap bodies.
  const tasksQuery = db.$queryRaw<Array<Pick<AuditVerifierExecution, 'workKind' | 'workState' | 'status' | 'workInput' | 'workResult'>>>`
    SELECT "workKind", "workState", "status", "workInput",
      CASE WHEN "workKind" = 'browser' THEN jsonb_set("workResult", '{data}', jsonb_build_object(
        'pageId', "workResult"->'data'->'pageId', 'metadata', "workResult"->'data'->'metadata',
        'snapshot', jsonb_build_object('desktopUrl', "workResult"->'data'->'snapshot'->'desktopUrl',
          'mobileUrl', "workResult"->'data'->'snapshot'->'mobileUrl',
          'renderedScope', "workResult"->'data'->'snapshot'->'renderedScope')))
      WHEN "workKind" = 'captures' THEN jsonb_set("workResult", '{data}', jsonb_build_object(
        'pageId', "workResult"->'data'->'pageId', 'snapshot', jsonb_build_object(
          'desktopUrl', "workResult"->'data'->'snapshot'->'desktopUrl', 'mobileUrl', "workResult"->'data'->'snapshot'->'mobileUrl')))
      WHEN "workKind" = 'http' THEN jsonb_set("workResult", '{data}', jsonb_build_object('metadata', "workResult"->'data'->'metadata'))
      WHEN "workKind" IN ('journeys', 'cross-page') THEN jsonb_set("workResult", '{data}', jsonb_build_object('flags', "workResult"->'data'->'flags'))
      WHEN "workKind" IN ('search-resources', 'keyboard', 'bindings', 'fixture-setup', 'automatic-accounts', 'finalize') THEN NULL
      ELSE "workResult" END AS "workResult"
    FROM "audit_verifier_executions" WHERE "auditId" = ${auditId} AND "targetKey" LIKE 'task:%'
      ${pageUrl ? Prisma.sql`AND "pageUrl" = ${pageUrl}` : Prisma.empty}
    ORDER BY "createdAt", "id" LIMIT ${MAX_TASKS_PER_AUDIT + 1}`
  const gapsQuery = db.$queryRaw<Array<{ pageUrl: string; targetKey: string }>>`
    SELECT DISTINCT COALESCE(task."pageUrl", receipt."pageUrl") AS "pageUrl", receipt."targetKey"
    FROM "audit_verifier_executions" receipt
    LEFT JOIN "audit_verifier_executions" task ON task."id" = (receipt."evidenceReference"->>'taskId')
      AND task."auditId" = receipt."auditId" AND task."targetKey" LIKE 'task:%'
    WHERE receipt."auditId" = ${auditId} AND receipt."targetKey" LIKE 'module:%'
      AND receipt."status" <> 'NOT_APPLICABLE' AND receipt."detail"->>'complete' = 'false'
      AND COALESCE(task."pageUrl", receipt."pageUrl") IS NOT NULL
      ${pageUrl ? Prisma.sql`AND COALESCE(task."pageUrl", receipt."pageUrl") = ${pageUrl}` : Prisma.empty}
    LIMIT ${MAX_TASKS_PER_AUDIT + 1}`
  const [tasks, gaps] = await Promise.all([tasksQuery, gapsQuery])
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
  if (gaps.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
  const positions = [...new Set(tasks.flatMap(task => {
    const input = task.workInput as { position?: number } | null
    return typeof input?.position === 'number' ? [input.position] : []
  }))].sort((a, b) => a - b)
  const pages: PageRun[] = []
  for (const position of positions) {
    const pageTasks = tasks.filter(task => (task.workInput as { position?: number })?.position === position)
    const find = (kind: string) => pageTasks.find(task => task.workKind === kind && task.workState === 'COMPLETED')
    const browserTask = find('browser'), httpTask = find('http'), searchTask = pageTasks.find(task => task.workKind === 'search' && task.workState === 'COMPLETED' &&
      (!((task.workInput as { module?: string })?.module) || (task.workInput as { module?: string })?.module === 'summary')), judgeTask = find('judge')
    const browser = browserTask?.workResult ? browserArtifactSchema.extend({ snapshot: screenshotSnapshotSchema.pick({ desktopUrl: true, mobileUrl: true, renderedScope: true }).extend({ renderedScope: screenshotSnapshotSchema.shape.renderedScope.nullable() }) }).parse(readArtifact(browserTask.workResult, 'browser').data) : null
    const captureTask = find('captures')
    const captures = captureTask?.workResult ? captureArtifactSchema.extend({ snapshot: screenshotSnapshotSchema.pick({ desktopUrl: true, mobileUrl: true }) }).parse(readArtifact(captureTask.workResult, 'captures').data) : null
    const response = httpTask?.workResult ? httpArtifactSchema.pick({ metadata: true }).parse(readArtifact(httpTask.workResult, 'http').data) : null
    const metadata = browser?.metadata ?? response?.metadata
    if (!metadata) continue
    const speedResults = pageTasks.filter(task => task.workKind === 'pagespeed' && task.workState === 'COMPLETED' && task.workResult)
      .map(task => speedArtifactSchema.parse(readArtifact(task.workResult, 'pagespeed').data))
    const speed = speedResults.length ? { desktop: speedResults.find(item => item.desktop)?.desktop ?? null,
      mobile: speedResults.find(item => item.mobile)?.mobile ?? null,
      desktopError: speedResults.find(item => item.desktopError)?.desktopError, mobileError: speedResults.find(item => item.mobileError)?.mobileError } : null
    const search = searchTask?.workResult ? searchArtifactSchema.parse(readArtifact(searchTask.workResult, 'search').data) : null
    const judged = judgeTask?.workResult ? judgeSchema.parse(readArtifact(judgeTask.workResult, 'judge').data) : null
    const flags = pageTasks.filter(task => task.workState === 'COMPLETED' && task.workResult).flatMap(task => {
      const artifact = readArtifact(task.workResult, task.workKind as TaskArtifact['kind'])
      return artifact.data.flags ? z.array(flagSchema).parse(artifact.data.flags) : []
    })
    const url = (pageTasks[0].workInput as { pageUrl: string }).pageUrl
    pages.push({ pageId: browser?.pageId ?? '', url, metadata, desktop: speed?.desktop ?? null, mobile: speed?.mobile ?? null,
      renderedScope: browser?.snapshot.renderedScope ?? undefined,
      desktopError: speed?.desktopError, mobileError: speed?.mobileError,
      desktopScreenshot: Boolean(captures?.snapshot.desktopUrl ?? browser?.snapshot.desktopUrl), mobileScreenshot: Boolean(captures?.snapshot.mobileUrl ?? browser?.snapshot.mobileUrl),
      desktopBase64: '', mobileBase64: null, flowScan: pageTasks.some(task => task.workKind === 'flow' && task.workState === 'COMPLETED' &&
        (task.workInput as { module?: string })?.module !== 'form-validation'),
      flags, failedModules: [...new Set([
        ...pageTasks.filter(task => task.status !== 'NOT_APPLICABLE' && ['BLOCKED', 'EXHAUSTED'].includes(task.workState ?? '')).map(task =>
          (task.workInput as { module?: string })?.module ?? task.workKind ?? 'unknown'),
        ...gaps.filter(gap => gap.pageUrl === url).map(gap => gap.targetKey.slice('module:'.length)),
      ])],
      triage: judged?.triage, triageFailure: judged?.triageFailure, searchReceipt: search?.receipt,
      detectedTech: [], industryGuess: null })
  }
  return pages
}

export const lifecycleHandlers: TaskHandler[] = [
  { kind: 'fixture-setup', replay: 'protected', timeoutMs: 70_000,
    validateResult: artifact => { safeFormExecutionResultSchema.parse(artifact.data) },
    async reconcile(context) {
      const setup = readExecutionSpec(context.audit.executionSpec)?.fixtureSetup
      return Boolean(setup && context.audit.projectId && await reconcileSafeFixtureCleanup({
        projectId: context.audit.projectId, fixtureId: setup.id, version: setup.version, auditId: context.audit.id,
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
      await tx.outcomeFixture.updateMany({ where: { id: setup.id, projectId: context.audit.projectId!, version: setup.version },
        data: { lastDryRunVersion: setup.version, lastDryRunAt: new Date(artifact.collectedAt), lastDryRunResult: result, authorizedAt: null } })
    },
  },
  { kind: 'discovery', replay: 'read_only', timeoutMs: 45_000,
    validateResult: artifact => { discoverySchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const result = discoverySchema.parse(artifact.data)
      for (const receipt of result.receipts ?? []) await commitCheckReceipt(context, receipt, tx, ':public-links:' + (context.input.module ?? 'first'))
      await commitFindings(context, artifact, tx)
    },
    async evaluate(context) {
      const spec = readExecutionSpec(context.audit.executionSpec)
      if (!spec) throw new TaskFailure('EXECUTION_SPEC_INVALID', false)
      const pages = await recordedPages(context.audit.id), primary = pages.find(page => page.url === spec.targetUrl)
      const depth = asReviewDepth(spec.reviewDepth ?? context.audit.reviewDepth)
      const plan = planReviewTargets({ pastedUrl: spec.targetUrl, depth, pastedLinks: primary ? resolvedPageLinks(primary.url, primary.metadata) : [],
        retainedUrls: spec.monitoringPages,
        linkedPageLinks: context.input.module === 'second' ? pages.filter(page => page !== primary).map(page => ({ pageUrl: page.url, links: resolvedPageLinks(page.url, page.metadata) })) : [] })
      const existing = await loadTaskGraph(context.audit.id)
      const allPlans: TaskPlan[] = existing.map(task => ({ kind: task.workKind as TaskPlan['kind'], key: task.targetKey.slice(5),
        scope: task.scopeKey, input: task.workInput as TaskPlan['input'], dependencies: task.workDependencies }))
      const known = new Set(existing.filter(task => task.workKind === 'browser').map(task => canonicalizeDestination(task.pageUrl!)?.key))
      let nextPosition = existing.filter(task => task.workKind === 'browser').length
      for (const url of plan.reviewUrls) if (!known.has(canonicalizeDestination(url)?.key) && nextPosition < 24) {
        allPlans.push(...pageTaskPlan({ pageUrl: url, primary: false, position: nextPosition++, role: 'linked' }, spec))
        known.add(canonicalizeDestination(url)?.key)
      }
      if (depth === 3 && context.input.module !== 'second') allPlans.push({ kind: 'discovery', key: 'discovery:second', scope: 'site:second',
        input: { ...context.input, module: 'second' }, dependencies: ['discovery', ...allPlans.filter(task => task.input.position > 0 && ['browser', 'http'].includes(task.kind)).map(task => task.key)] })
      for (const task of allPlans) {
        if (task.kind === 'cross-page') task.dependencies = allPlans.filter(item => ['discovery', 'search'].includes(item.kind)).map(item => item.key)
        if (task.kind === 'finalize') task.dependencies = allPlans.filter(item => item.kind !== 'finalize').map(item => item.key)
      }
      // Extend summary dependencies before this discovery checkpoint becomes settled.
      await persistTaskPlan(context.audit.id, allPlans)
      const opened = await openCheckDestinations(plan.openCheckUrls, {
        origin: spec.targetUrl, ceiling: openCheckCeilingForDepth(depth),
        deadline: context.deadline,
      })
      const sources = context.input.module === 'second' ? pages : primary ? [primary] : []
      const observations = sources.map(page => {
        const urls = publicLinkUrls(page.url, page.metadata)
        const checked = publicLinkObservations(page.url, urls, opened.results)
        return { ...checked, receipt: checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'seo',
          pageUrl: page.url, passed: checked.complete && checked.flags.length === 0, applicable: true,
          assertions: checked.assertions, complete: checked.complete, limitation: checked.limitation,
          execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'http', collectedAt: new Date().toISOString() } }) }
      })
      return serializeArtifact('discovery', discoverySchema.parse({ pages: plan.reviewUrls,
        openCheckCount: opened.results.length, truncated: plan.truncated || opened.truncated,
        flags: observations.flatMap(result => result.flags), receipts: observations.map(result => result.receipt) }))
    },
  },
  { kind: 'cross-page', replay: 'read_only', timeoutMs: 12_000,
    validateResult: artifact => { crossPageSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      for (const receipt of crossPageSchema.parse(artifact.data).receipts ?? []) await commitCheckReceipt(context, receipt, tx)
      await commitFindings(context, artifact, tx)
    },
    async evaluate(context) {
      const pages = await recordedPages(context.audit.id)
      const search = await runCheckedPageSearch(pages.flatMap(page => page.searchReceipt ? [page.searchReceipt] : []))
      const corridor = evaluateCorridorConsistency(pages.map((page, index) => ({ url: page.url, role: index ? 'linked' : 'primary',
        title: page.metadata.title, ogTitle: page.metadata.ogTitle, ogDescription: page.metadata.ogDescription, scope: page.renderedScope })))
      const receipts = [...corridor.assertions].map(([pageUrl, assertions]) => checkReceiptSchema.parse({
        kind: 'site-module-check', version: 1, module: 'corridor', pageUrl, applicable: assertions.some(assertion => assertion.disposition !== 'observed'),
        complete: assertions.every(assertion => assertion.complete), passed: assertions.every(assertion => assertion.complete && (assertion.disposition === 'observed' || assertion.passed)), assertions,
        execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
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
        fixtureId: binding.fixture.id, version: binding.fixture.version, auditId: context.audit.id })
    },
    async evaluate(context) {
      if (!context.input.outcomeId || !context.input.bindingKey) throw new TaskFailure('BINDING_INTENT_INVALID', false)
      const executed = await runBoundOutcomeExecutions(context.audit.id, { outcomeId: context.input.outcomeId, bindingKey: context.input.bindingKey })
      return serializeArtifact('bindings', bindingSchema.parse({ executed, outcomeId: context.input.outcomeId, bindingKey: context.input.bindingKey }))
    },
  },
  { kind: 'journeys', replay: 'read_only', timeoutMs: 60_000,
    validateResult: artifact => { journeySchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      for (const receipt of journeySchema.parse(artifact.data).overlayReceipts ?? []) await commitCheckReceipt(context, receipt, tx, overlayReceiptScope(receipt))
      for (const receipt of journeySchema.parse(artifact.data).pageReceipts ?? []) await commitCheckReceipt(context, receipt, tx, journeyReceiptScope(receipt))
      await commitFindings(context, artifact, tx)
      const rows = await tx.journeyFinding.findMany({ where: { journeyReview: { auditId: context.audit.id }, flagId: null,
        OR: [{ checkId: { in: ['overlay-blocks-nav', 'overlay-blocks-cta', 'overlay-blocks-form', ...Object.values(JOURNEY_ASSERTIONS).flat()] } },
          { checkId: { endsWith: '-hidden-cta' } }, { checkId: { endsWith: '-dead-end' } }] }, take: 500, select: { id: true, checkId: true, url: true, journeyReview: { select: { startUrl: true } } } })
      for (const row of rows) {
        const flag = await tx.flag.findFirst({ where: { auditId: context.audit.id, checkId: durableCheckId(row.checkId),
          OR: [{ pageUrl: row.journeyReview.startUrl }, { affectedPaths: { array_contains: row.journeyReview.startUrl } }] }, select: { id: true } })
        if (flag) await tx.journeyFinding.update({ where: { id: row.id }, data: { flagId: flag.id } })
      }
    },
    async evaluate(context) {
      if (!browserEvidence(context)?.metadata) throw new TaskFailure('JOURNEY_PAGE_UNAVAILABLE', false)
      const spec = readExecutionSpec(context.audit.executionSpec), target = spec?.verificationTarget
      const phases = spec?.verificationScopes?.find(scope => scope.pageUrl === context.input.pageUrl)?.overlayPhases?.filter(phase => phase.startsWith('journey_'))
      const sources = target?.kind === 'DIAGNOSTIC' ? await prisma.flag.findMany({ where: { auditId: target.parentAuditId,
        audit: { projectId: context.audit.projectId }, checkId: target.checkId }, take: 100, select: { evidenceTargets: true, verificationRule: true } })
        : context.audit.projectId ? await prisma.flag.findMany({ where: { auditId: { not: context.audit.id },
          audit: { projectId: context.audit.projectId, status: 'COMPLETED' }, verificationRule: JOURNEY_VERIFICATION_RULE },
          orderBy: { createdAt: 'desc' }, take: 100, select: { evidenceTargets: true, verificationRule: true } }) : []
      const expected = sources.flatMap(flag => scopedOverlayRule(flag.verificationRule) && Array.isArray(flag.evidenceTargets) ? flag.evidenceTargets.flatMap(value => {
        const parsed = z.object({ context: z.string(), selector: z.string(), label: z.string() }).safeParse(value)
        if (!parsed.success || !parsed.data.context.startsWith('overlay:' + capturePageKey(context.input.pageUrl) + ':') || !phases?.includes(parsed.data.context.split(':')[3])) return []
        const scoped = overlayTargetSchema.safeParse({ ...parsed.data, kind: parsed.data.context.split(':')[4] })
        return scoped.success ? [scoped.data] : []
      }) : [])
      const journeyTarget = target?.kind === 'DIAGNOSTIC' && Object.values(JOURNEY_ASSERTIONS).flat().some(checkId => checkId === target.checkId)
      const conditions = sources.flatMap(flag => flag.verificationRule === JOURNEY_VERIFICATION_RULE && Array.isArray(flag.evidenceTargets)
        ? flag.evidenceTargets.flatMap(value => {
          const parsed = z.object({ context: z.string() }).passthrough().safeParse(value)
          const condition = parsed.success ? readJourneyContext(parsed.data.context) : undefined
          return condition?.pageKey === capturePageKey(context.input.pageUrl) ? [condition] : []
        }) : [])
      const observations: OverlayObservation[] = []
      const pages: JourneyObservation[] = [], findings: JourneyFindingDraft[] = []
      const findingCount = await runJourneyReviewsForAudit(context.audit.id, context.input.pageUrl,
        { included: true, deadline: context.deadline, scanAccess: await resolveAuditScanAccess(context.audit.id),
          ...(phases?.length ? { overlayPhases: phases, overlayExpectedTargets: expected, allowedCheckIds: Object.keys(spec!.checks) } : {}),
          ...(journeyTarget ? { expectedJourneyConditions: conditions, allowedCheckIds: Object.keys(spec!.checks) } : {}),
          ...(!journeyTarget && conditions.length ? { recordedJourneyConditions: conditions } : {}),
          onOverlayObservations: found => observations.push(...found),
          onPageObservations: found => pages.push(...found), onJourneyFindings: found => findings.push(...found) })
      return serializeArtifact('journeys', journeySchema.parse({ findingCount,
        flags: [...observations.flatMap(runObservedOverlayChecks), ...nativeJourneyFlags(findings)],
        pageReceipts: journeyReceipts(pages, { auditId: context.audit.id, taskId: context.task.id, collectedAt: new Date().toISOString() }),
        overlayReceipts: overlayCheckReceipts(observations, { auditId: context.audit.id, taskId: context.task.id, collectedAt: new Date().toISOString() }) }))
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
        const bytes = await readScreenshot(context.audit.id, device, pageKey)
        return bytes?.toString('base64') ?? null
      }
      const desktop = await capture(captures?.snapshot.desktopUrl, 'desktop'), mobile = await capture(captures?.snapshot.mobileUrl, 'mobile')
      const result = await judgePageStage(await pipelineContext(context), { pageId: page.pageId, url: page.url,
        metadata: page.metadata, desktop: page.desktop, mobile: page.mobile, flags: page.flags,
        desktopBase64: desktop ?? '', mobileBase64: mobile, completeness: page.failedModules.length ? 'PARTIAL' : 'FULL' })
      return serializeArtifact('judge', judgeSchema.parse(result.artifact ?? {}))
    },
  },
  { kind: 'finalize', replay: 'idempotent', timeoutMs: 90_000,
    validateResult: artifact => { finalSchema.parse(artifact.data) },
    async evaluate(context) {
      const latest = await prisma.audit.findUniqueOrThrow({ where: { id: context.audit.id }, select: { id: true, status: true, parentId: true,
        reportCompleteness: true, executionSpec: true, completedAt: true, startedAt: true, createdAt: true, url: true } })
      if (latest.status === 'COMPLETED') {
        await persistImprovementCycle(latest.id, latest.parentId)
        return serializeArtifact('finalize', { status: 'COMPLETED', partial: latest.reportCompleteness !== 'FULL' })
      }
      const tasks = await loadTaskGraph(latest.id)
      const failed = tasks.filter(task => task.status !== 'NOT_APPLICABLE' && ['BLOCKED', 'EXHAUSTED'].includes(task.workState ?? '')).map(task => task.workKind ?? 'unknown')
      const incomplete = await prisma.auditVerifierExecution.findMany({ where: { auditId: latest.id,
        targetKey: { startsWith: 'module:' }, detail: { path: ['complete'], equals: false } },
        take: MAX_TASKS_PER_AUDIT, select: { targetKey: true } })
      failed.push(...incomplete.map(receipt => receipt.targetKey.slice('module:'.length)))
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
      const pages = await recordedPages(latest.id), ctx = await pipelineContext(context)
      const accountTask = await prisma.auditVerifierExecution.findFirst({ where: { auditId: latest.id, workKind: 'automatic-accounts', workState: 'COMPLETED' }, select: { workResult: true } })
      if (accountTask?.workResult && pages[0]) {
        const accountFlags = z.array(flagSchema).parse(readArtifact(accountTask.workResult, 'automatic-accounts').data.flags ?? [])
        pages[0].flags.push(...accountFlags)
      }
      if (spec?.category) {
        const missingPages = spec.category.pages.filter(url => !pages.some(page => page.url === url))
        if (missingPages.length) failed.push('category-pages')
        if (pages.some(page => page.searchReceipt?.complete === false)) failed.push('search')
        await persistDeterministicFlags(latest.id, pages.flatMap(page => page.flags), { MESSAGE: null, EXPERIENCE: null, REACH: null },
          undefined, { authoritativeProjection: true })
        await persistAuditRunCost(latest.id, { durationMs: Date.now() - (latest.startedAt ?? latest.createdAt).getTime(),
          llmInputTokens: 0, llmOutputTokens: 0, llmModel: 'none',
          pagespeedCalls: pages.reduce((count, page) => count + Number(Boolean(page.desktop)) + Number(Boolean(page.mobile)), 0), pagesReviewed: pages.length })
        await executionWrite(async tx => {
          for (const page of pages) await tx.auditPage.updateMany({ where: { auditId: latest.id, url: page.url, status: { not: 'FAILED' } },
            data: { status: 'COMPLETED' } })
          await tx.audit.update({ where: { id: latest.id }, data: {
            status: 'COMPLETED', progress: 100, verdict: null,
            reportCompleteness: failed.length ? 'PARTIAL' : 'FULL', failedModules: [...new Set(failed)],
            evidenceCoverage: { version: 1, scope: 'CATEGORY', area: spec.category!.area,
              metadata: pages.length === spec.category!.pages.length,
              desktopPageSpeed: pages.length > 0 && pages.every(page => Boolean(page.desktop)),
              mobilePageSpeed: pages.length > 0 && pages.every(page => Boolean(page.mobile)),
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
        reviewCoverage: buildReviewCoverage({ reviewedPageCount: pages.length, openCheckCount: 0, partial: failed.length > 0 }),
        failedModules: failed } }))
      await persistDeterministicFlags(latest.id, pages.flatMap(page => page.flags), productScoresFromFlags(pages),
        undefined, { authoritativeProjection: true })
      if (pages.length) await finalizeFromOutcome({ ctx, auditId: latest.id, auditUrl: latest.url, pageRuns: pages, startedAt: ctx.startedAt,
        captureAdditionalEvidence: false })
      else await finalizeTriageDegraded({ auditId: latest.id, durationMs: Date.now() - ctx.startedAt.getTime(), pagespeedCalls: 0,
        evidence: { desktopScreenshot: false, mobileScreenshot: false, metadata: false, desktopPageSpeed: false, mobilePageSpeed: false },
        reason: 'unknown', errorMsg: 'Collection finished without enough page evidence to establish a verdict.' })
      if (failed.length) await executionWrite(tx => tx.audit.update({ where: { id: latest.id }, data: { reportCompleteness: 'PARTIAL', failedModules: failed } }))
      return serializeArtifact('finalize', { status: 'COMPLETED', partial: failed.length > 0 || !pages.length || pages.some(page => !page.triage) })
    },
  },
]
