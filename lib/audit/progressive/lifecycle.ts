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
import { openCheckDestinations, deadDestinationFlags } from '../open-check'
import { canonicalizeDestination } from '../url-identity'
import { runCheckedPageSearch } from '../search/workflow'
import { runCorridorConsistencyChecks } from '../checks/corridor-consistency'
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
import { productScoresFromFlags, collapsedPageFlags } from '../pipeline/combine-pages'
import { readScreenshot } from '@/lib/storage/screenshots'
import type { PageRun, PipelineContext } from '../pipeline/types'
import type { TaskContext, TaskHandler } from './registry'
import { persistAuditRunCost } from '@/lib/billing/costs'

const findingsSchema = z.object({ flags: z.array(flagSchema).max(500) }).strict()
const discoverySchema = z.object({ flags: z.array(flagSchema).max(500),
  pages: z.array(z.string().url()).max(24), openCheckCount: z.number().int().nonnegative().max(120), truncated: z.boolean() }).strict()
const bindingSchema = z.object({ executed: z.boolean(), outcomeId: z.string(), bindingKey: z.string() }).strict()
const journeySchema = z.object({ findingCount: z.number().int().nonnegative() }).strict()
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
  const tasks = await db.$queryRaw<Array<Pick<AuditVerifierExecution, 'workKind' | 'workState' | 'status' | 'workInput' | 'workResult'>>>`
    SELECT "workKind", "workState", "status", "workInput",
      CASE WHEN "workKind" = 'browser' THEN jsonb_set("workResult", '{data}', jsonb_build_object(
        'pageId', "workResult"->'data'->'pageId', 'metadata', "workResult"->'data'->'metadata',
        'snapshot', jsonb_build_object('desktopUrl', "workResult"->'data'->'snapshot'->'desktopUrl',
          'mobileUrl', "workResult"->'data'->'snapshot'->'mobileUrl')))
      WHEN "workKind" = 'captures' THEN jsonb_set("workResult", '{data}', jsonb_build_object(
        'pageId', "workResult"->'data'->'pageId', 'snapshot', jsonb_build_object(
          'desktopUrl', "workResult"->'data'->'snapshot'->'desktopUrl', 'mobileUrl', "workResult"->'data'->'snapshot'->'mobileUrl')))
      WHEN "workKind" = 'http' THEN jsonb_set("workResult", '{data}', jsonb_build_object('metadata', "workResult"->'data'->'metadata'))
      WHEN "workKind" IN ('search-resources', 'keyboard', 'bindings', 'journeys', 'fixture-setup', 'finalize') THEN NULL
      ELSE "workResult" END AS "workResult"
    FROM "audit_verifier_executions" WHERE "auditId" = ${auditId} AND "targetKey" LIKE 'task:%'
      ${pageUrl ? Prisma.sql`AND "pageUrl" = ${pageUrl}` : Prisma.empty}
    ORDER BY "createdAt", "id" LIMIT ${MAX_TASKS_PER_AUDIT + 1}`
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
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
    const browser = browserTask?.workResult ? browserArtifactSchema.extend({ snapshot: screenshotSnapshotSchema.pick({ desktopUrl: true, mobileUrl: true }) }).parse(readArtifact(browserTask.workResult, 'browser').data) : null
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
      desktopError: speed?.desktopError, mobileError: speed?.mobileError,
      desktopScreenshot: Boolean(captures?.snapshot.desktopUrl ?? browser?.snapshot.desktopUrl), mobileScreenshot: Boolean(captures?.snapshot.mobileUrl ?? browser?.snapshot.mobileUrl),
      desktopBase64: '', mobileBase64: null, flowScan: pageTasks.some(task => task.workKind === 'flow' && task.workState === 'COMPLETED'),
      flags, failedModules: pageTasks.filter(task => task.status !== 'NOT_APPLICABLE' && ['BLOCKED', 'EXHAUSTED'].includes(task.workState ?? '')).map(task =>
        (task.workInput as { module?: string })?.module ?? task.workKind ?? 'unknown'),
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
    validateResult: artifact => { discoverySchema.parse(artifact.data) }, commit: commitFindings,
    async evaluate(context) {
      const spec = readExecutionSpec(context.audit.executionSpec)
      if (!spec) throw new TaskFailure('EXECUTION_SPEC_INVALID', false)
      const pages = await recordedPages(context.audit.id), primary = pages.find(page => page.url === spec.targetUrl)
      const depth = asReviewDepth(spec.reviewDepth ?? context.audit.reviewDepth)
      const plan = planReviewTargets({ pastedUrl: spec.targetUrl, depth, pastedLinks: primary?.metadata.links ?? [],
        linkedPageLinks: context.input.module === 'second' ? pages.filter(page => page !== primary).map(page => ({ pageUrl: page.url, links: page.metadata.links })) : [] })
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
      })
      return serializeArtifact('discovery', discoverySchema.parse({ pages: plan.reviewUrls,
        openCheckCount: opened.results.length, truncated: plan.truncated || opened.truncated,
        flags: deadDestinationFlags(opened.results, spec.targetUrl) }))
    },
  },
  { kind: 'cross-page', replay: 'read_only', timeoutMs: 12_000,
    validateResult: artifact => { findingsSchema.parse(artifact.data) }, commit: commitFindings,
    async evaluate(context) {
      const pages = await recordedPages(context.audit.id)
      const search = await runCheckedPageSearch(pages.flatMap(page => page.searchReceipt ? [page.searchReceipt] : []))
      const corridor = runCorridorConsistencyChecks(pages.map((page, index) => ({ url: page.url, role: index ? 'linked' : 'primary',
        title: page.metadata.title, ogTitle: page.metadata.ogTitle, ogDescription: page.metadata.ogDescription })))
      return serializeArtifact('cross-page', findingsSchema.parse({ flags: [...search, ...corridor] }))
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
    async evaluate(context) {
      if (!browserEvidence(context)?.metadata) throw new TaskFailure('JOURNEY_PAGE_UNAVAILABLE', false)
      const findingCount = await runJourneyReviewsForAudit(context.audit.id, context.input.pageUrl,
        { included: true, deadline: context.deadline, scanAccess: await resolveAuditScanAccess(context.audit.id) })
      return serializeArtifact('journeys', journeySchema.parse({ findingCount }))
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
      if (spec && spec.scope !== 'SITE') {
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
      if (pages.some(page => page.searchReceipt?.complete === false)) failed.push('search')
      ctx.pagespeedCalls = pages.reduce((count, page) => count + Number(Boolean(page.desktop)) + Number(Boolean(page.mobile)), 0)
      for (const page of pages) if (page.triage) {
        ctx.usage.inputTokens += page.triage.usage.inputTokens; ctx.usage.outputTokens += page.triage.usage.outputTokens
        ctx.usage.models.push(page.triage.usage.model)
      }
      await executionWrite(tx => tx.audit.update({ where: { id: latest.id }, data: { status: 'FINALIZING',
        reviewCoverage: buildReviewCoverage({ reviewedPageCount: pages.length, openCheckCount: 0, partial: failed.length > 0 }),
        failedModules: failed } }))
      await persistDeterministicFlags(latest.id, collapsedPageFlags(pages), productScoresFromFlags(pages))
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
