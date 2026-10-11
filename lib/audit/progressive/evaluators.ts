import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { runAllChecks } from '../checks'
import { runPerformanceChecks } from '../checks/performance'
import { runMobileChecks } from '../checks/mobile'
import { runSecurityHeaderChecks } from '../checks/security-headers'
import { recordCheckObservations } from '../checks/observations'
import { parseMetadataFromHtml } from '../metadata'
import { readScreenshotSnapshot, browserArtifactSchema, captureArtifactSchema, httpArtifactSchema, speedArtifactSchema, resourceArtifactSchema } from './snapshots'
import { serializeArtifact, readArtifact, TaskFailure } from './contracts'
import { checkArtifactSchema, commitFindings, flagSchema } from './results'
import type { TaskContext, TaskHandler } from './registry'
import { runSearchWorkflow, priorSearchReceipt, recordSearchVerifiers, combineSearchReceipts } from '../search/workflow'
import { runGoogleSearchForAudit } from '../search/google'
import { searchReceiptSchema } from '../search/contracts'
import { searchFindings } from '../search/registry'
import { collectSearchEvidence, missingDocument } from '../search/collect'
import { checkReceiptSchema } from '../checks/receipt'
import { SEARCH_CHECK_DEFINITIONS } from '../search/registry'
import { CHECK_MODULES, CHECK_REGISTRY } from '../check-registry'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { suppressFlagsForPageRole } from '../suppression'
import { evaluateSearchIsolated } from './cpu'
import { executionWrite } from '../execution-ownership'
import { recordAssertionVerifiers } from '../checks/verification'

function dependency(context: TaskContext, kind: string) {
  return [...context.dependencies.values()].find(item => item.workKind === kind && item.workState === 'COMPLETED')
}
export function browserEvidence(context: TaskContext) {
  const value = dependency(context, 'browser')
  return value?.workResult ? browserArtifactSchema.parse(readArtifact(value.workResult, 'browser').data) : null
}
export function httpEvidence(context: TaskContext) {
  const value = dependency(context, 'http')
  return value?.workResult ? httpArtifactSchema.parse(readArtifact(value.workResult, 'http').data) : null
}
export function captureEvidence(context: TaskContext) {
  const value = dependency(context, 'captures')
  return value?.workResult ? captureArtifactSchema.parse(readArtifact(value.workResult, 'captures').data) : null
}
export function speedEvidence(context: TaskContext) {
  const values = [...context.dependencies.values()].filter(item => item.workKind === 'pagespeed' && item.workState === 'COMPLETED' && item.workResult)
    .map(item => speedArtifactSchema.parse(readArtifact(item.workResult, 'pagespeed').data))
  return values.length ? { desktop: values.find(value => value.desktop)?.desktop ?? null,
    mobile: values.find(value => value.mobile)?.mobile ?? null } : null
}

export const searchArtifactSchema = z.object({ receipt: searchReceiptSchema, flags: z.array(flagSchema).max(500) }).strict()
const googleArtifactSchema = z.object({ receipts: z.array(searchReceiptSchema).max(24), flags: z.array(flagSchema).max(500) }).strict()

export const evaluatorHandlers: TaskHandler[] = [
  { kind: 'check', replay: 'read_only', timeoutMs: 12_000,
    validateResult: artifact => { checkArtifactSchema.parse(artifact.data) }, commit: commitFindings,
    async evaluate(context) {
      const checkModule = context.input.module, definition = checkModule ? CHECK_MODULES[checkModule] : null
      if (!checkModule || !definition || checkModule === 'search') throw new TaskFailure('CHECK_NOT_REGISTERED', false)
      const spec = readExecutionSpec(context.audit.executionSpec)
      const selected = Object.entries(spec?.checks ?? {}).filter(([id]) => CHECK_REGISTRY[id]?.module === checkModule)
      if (!selected.length) throw new TaskFailure('CHECK_NOT_ADMITTED', false)
      if (selected.some(([id, version]) => CHECK_REGISTRY[id]?.version !== version))
        throw new TaskFailure('CHECK_VERSION_UNAVAILABLE', false)
      const browser = browserEvidence(context), response = httpEvidence(context), speed = speedEvidence(context)
      const metadata = checkModule === 'security' ? response?.metadata : browser?.metadata
      const snapshot = browser ? readScreenshotSnapshot(browser.snapshot) : null
      let flags: import('../flag-types').DeterministicFlag[], assertions: import('../checks/assertion').CheckAssertion[] = []
      let applicable = true
      if (checkModule === 'performance' || checkModule === 'mobile') {
        if (checkModule === 'performance' && context.input.device === 'mobile' && speed?.desktop)
          throw new TaskFailure('MOBILE_INP_FALLBACK_NOT_APPLICABLE', false)
        applicable = checkModule === 'mobile' ? Boolean(speed?.mobile) : Boolean(speed?.desktop || speed?.mobile)
        if (!applicable) throw new TaskFailure('PERFORMANCE_EVIDENCE_UNAVAILABLE', false)
        flags = checkModule === 'mobile' ? runMobileChecks(speed!.mobile) : runPerformanceChecks(speed!.desktop, speed!.mobile)
        // The unused metadata argument is confined to this legacy observation adapter.
        assertions = recordCheckObservations(checkModule, { url: context.input.pageUrl,
          metadata: parseMetadataFromHtml('', context.input.pageUrl), desktop: speed!.desktop, mobile: speed!.mobile })
      } else if (checkModule === 'security-headers') {
        if (!response?.document.status) throw new TaskFailure('RESPONSE_EVIDENCE_UNAVAILABLE', false)
        flags = runSecurityHeaderChecks(response.document.finalUrl, response.document.headers)
        assertions = recordCheckObservations(checkModule, { url: response.document.finalUrl,
          metadata: parseMetadataFromHtml('', context.input.pageUrl), headers: response.document.headers, desktop: null, mobile: null })
      } else {
        if (!metadata) throw new TaskFailure('PAGE_EVIDENCE_UNAVAILABLE', false)
        if (definition.input === 'browser' && !snapshot?.captureMetrics) throw new TaskFailure('RENDERED_METRICS_UNAVAILABLE', false)
        if (definition.input === 'accessibility' && snapshot?.axeViolations === undefined) throw new TaskFailure('ACCESSIBILITY_EVIDENCE_UNAVAILABLE', false)
        const observedUrl = checkModule === 'security' ? response!.document.finalUrl : snapshot?.desktopFinalUrl ?? context.input.pageUrl
        const checked = await runAllChecks(observedUrl, metadata, null, null, snapshot?.consoleErrors ?? [], undefined,
          snapshot?.captureMetrics, response?.document.headers ?? snapshot?.responseHeaders, snapshot?.axeViolations, true, [checkModule])
        if (checked.failedModules.length) throw new TaskFailure('CHECK_EVALUATION_INTERRUPTED', true, undefined, true)
        if (checked.executions.length !== 1 || checked.executions[0].module !== checkModule) throw new TaskFailure('EVALUATOR_NOT_REGISTERED', false)
        flags = checked.flags
        assertions = checked.executions[0]?.assertions ?? []
        applicable = checked.executions[0]?.applicable === true
      }
      flags = suppressFlagsForPageRole(flags, context.input.role)
        .map(flag => ({ ...flag, pageUrl: context.input.pageUrl }))
      const sourceKind = checkModule === 'security' || checkModule === 'security-headers' ? 'http'
        : checkModule === 'performance' || checkModule === 'mobile' ? 'pagespeed' : 'browser'
      const sourceTask = dependency(context, sourceKind)
      if (!sourceTask?.workResult) throw new TaskFailure('ASSERTION_SOURCE_UNAVAILABLE', false)
      const source = readArtifact(sourceTask.workResult, sourceKind)
      const device = checkModule === 'mobile' || context.input.device === 'mobile' ? 'mobile' : 'desktop'
      return serializeArtifact('check', checkArtifactSchema.parse({ flags, receipt: {
        kind: 'site-module-check', version: 1, module: checkModule, passed: flags.length === 0, applicable, pageUrl: context.input.pageUrl, assertions,
        execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: definition.version,
          source: checkModule === 'security' ? 'original-html' : checkModule === 'security-headers' ? 'http' : checkModule === 'performance' ? `pagespeed-${device}`
            : checkModule === 'mobile' ? 'pagespeed-mobile' : checkModule === 'accessibility' ? 'axe' : 'rendered-dom',
          collectedAt: source.collectedAt },
      } }))
    },
  },
  { kind: 'search', replay: 'read_only', timeoutMs: 35_000,
    validateResult: artifact => { searchArtifactSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const { receipt } = searchArtifactSchema.parse(artifact.data)
      const receiptModule = !context.input.module || context.input.module === 'summary' ? 'search' : context.input.module
      if (context.input.module !== 'summary') await tx.auditVerifierExecution.upsert({
        where: { auditId_targetKey_scopeKey: { auditId: context.audit.id, targetKey: 'module:' + receiptModule, scopeKey: 'page:' + receipt.pageUrl } },
        create: { auditId: context.audit.id, targetKey: 'module:' + receiptModule, scopeKey: 'page:' + receipt.pageUrl,
          pageUrl: receipt.pageUrl, source: 'SEARCH', status: 'COMPLETED', detail: receipt as Prisma.InputJsonValue,
          evidenceReference: { auditId: context.audit.id, taskId: context.task.id, module: receiptModule, pageUrl: receipt.pageUrl } }, update: {},
      })
      if (context.input.module !== 'summary') await recordSearchVerifiers(receipt, tx)
      await commitFindings(context, artifact, tx)
    },
    async evaluate(context) {
      if (context.input.module === 'summary') {
        const results = [...context.dependencies.values()].filter(task => task.workState === 'COMPLETED' && task.workResult)
          .map(task => searchArtifactSchema.parse(readArtifact(task.workResult, 'search').data))
        const receipt = combineSearchReceipts({ auditId: context.audit.id, pageUrl: context.input.pageUrl,
          receipts: results.map(result => result.receipt), expected: context.task.workDependencies.length })
        return serializeArtifact('search', { receipt, flags: searchFindings(results.flatMap(result => result.receipt.observations)) })
      }
      const evaluator = context.input.module?.replace(/^search-/, '')
      if (evaluator && !SEARCH_CHECK_DEFINITIONS.some(definition => definition.id === 'search.' + evaluator))
        throw new TaskFailure('SEARCH_EVALUATOR_NOT_REGISTERED', false)
      const response = httpEvidence(context), browser = browserEvidence(context), snapshot = browser ? readScreenshotSnapshot(browser.snapshot) : null
      const resourceTask = dependency(context, 'search-resources')
      const cache = new Map()
      if (resourceTask?.workResult) cache.set(new URL(context.input.pageUrl).origin,
        Promise.resolve(resourceArtifactSchema.parse(readArtifact(resourceTask.workResult, 'search-resources').data)))
      else cache.set(new URL(context.input.pageUrl).origin, Promise.resolve({
        robots: missingDocument(new URL('/robots.txt', context.input.pageUrl).toString(), 'resource_collection_incomplete'),
        sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [],
      }))
      const input = { auditId: context.audit.id, pageUrl: context.input.pageUrl,
        original: response?.document, renderedHtml: snapshot?.desktopHtml ?? null,
        renderedCollectedAt: dependency(context, 'browser')?.workResult ? readArtifact(dependency(context, 'browser')!.workResult, 'browser').collectedAt : undefined,
        renderedComplete: Boolean(snapshot?.desktopHtml) && !snapshot?.collectionRestrictions?.length, headers: snapshot?.responseHeaders ?? undefined,
        finalUrl: snapshot?.desktopFinalUrl, status: snapshot?.desktopHttpStatus, deadline: context.deadline, cache,
        privateCapture: Boolean(context.audit.scanAccessEncrypted), collectCanonicalTargets: !evaluator || evaluator === 'canonical' }
      if (!evaluator) {
        const result = await runSearchWorkflow({ ...input,
          evaluate: (evidence, previous) => evaluateSearchIsolated(evidence, previous, context.deadline) })
        return serializeArtifact('search', searchArtifactSchema.parse({ receipt: result.receipt, flags: result.findings }))
      }
      const evidence = await collectSearchEvidence(input)
      const previous = await priorSearchReceipt(context.audit.id, context.input.pageUrl, evaluator)
      let observations = await evaluateSearchIsolated(evidence, previous, context.deadline, [evaluator])
      let complete = !observations.some(item => item.disposition === 'unknown') &&
        (!['indexing', 'discovery'].includes(evaluator) || evidence.sitemapsComplete)
      if (observations.length > 499) {
        observations = observations.slice(0, 499)
        observations.push({ ...observations[0], id: 'search-observation-coverage:' + evaluator, checkId: 'search-observation-coverage',
          disposition: 'unknown', reason: 'observation_limit', attention: { policy: 'search', version: 1, kind: 'observation', reason: 'observation_limit' } })
        complete = false
      }
      const result = { receipt: searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: context.audit.id,
        pageUrl: context.input.pageUrl, collectedAt: evidence.collectedAt, complete, observations }), findings: searchFindings(observations) }
      return serializeArtifact('search', searchArtifactSchema.parse({ receipt: result.receipt, flags: result.findings }))
    },
  },
  { kind: 'google', replay: 'read_only', timeoutMs: 35_000,
    validateResult: artifact => { googleArtifactSchema.parse(artifact.data) }, commit: commitFindings,
    async evaluate(context) {
      const local = dependency(context, 'search')
      const receipt = local?.workResult ? searchArtifactSchema.parse(readArtifact(local.workResult, 'search').data).receipt : undefined
      const result = await runGoogleSearchForAudit({ auditId: context.audit.id, userId: context.audit.userId,
        pages: [{ url: context.input.pageUrl, local: receipt }], deadline: context.deadline,
        sections: context.input.module === 'google-performance' ? ['analytics'] : ['index'],
        receiptModule: context.input.module === 'google-performance' ? 'search-google-performance' : 'search-google-index',
        deferTransient: true })
      const interruption = result.receipts.flatMap(item => item.observations).find(item => ['PROVIDER_UNAVAILABLE', 'PROVIDER_QUOTA'].includes(item.reason))
      if (interruption) {
        await executionWrite(tx => tx.auditPipelineEvent.create({ data: { auditId: context.audit.id, executionId: context.task.id,
          traceId: context.audit.id, attempt: context.task.workAttempts, stage: 'checking', event: 'provider_attempt_observed', status: 'partial',
          detail: { version: 1, receipts: result.receipts as Prisma.InputJsonValue } } }))
        throw new TaskFailure(interruption.reason, true, result.retryAfterMs || (interruption.reason === 'PROVIDER_QUOTA' ? 60_000 : undefined))
      }
      return serializeArtifact('google', googleArtifactSchema.parse({ receipts: result.receipts,
        flags: result.receipts.flatMap(item => searchFindings(item.observations)) }))
    },
  },
]

/** Compatibility receipts are published in the same commit as progressive results. */
const commitChecks = evaluatorHandlers.find(handler => handler.kind === 'check')!
commitChecks.commit = async (context, artifact, tx: Prisma.TransactionClient) => {
  const result = checkArtifactSchema.parse(artifact.data), receipt = checkReceiptSchema.parse(result.receipt)
  await tx.auditVerifierExecution.upsert({
    where: { auditId_targetKey_scopeKey: { auditId: context.audit.id, targetKey: 'module:' + receipt.module,
      scopeKey: 'page:' + receipt.pageUrl + (context.input.device ? ':device:' + context.input.device : '') } },
    create: { auditId: context.audit.id, targetKey: 'module:' + receipt.module,
      scopeKey: 'page:' + receipt.pageUrl + (context.input.device ? ':device:' + context.input.device : ''),
      source: 'DETERMINISTIC', pageUrl: receipt.pageUrl, status: 'COMPLETED', checkVersion: 1,
      detail: receipt as Prisma.InputJsonValue, evidenceReference: { auditId: context.audit.id, taskId: context.task.id, module: receipt.module, pageUrl: receipt.pageUrl } }, update: {},
  })
  await recordAssertionVerifiers({ auditId: context.audit.id, parentId: context.audit.parentId,
    primary: context.input.primary, receipt }, tx)
  await commitFindings(context, artifact, tx)
}
