import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { runAllChecks } from '../checks'
import { runPerformanceChecks, runInpChecks } from '../checks/performance'
import { runMobileChecks } from '../checks/mobile'
import { runSecurityHeaderChecks, SECURITY_HEADER_LIMITATION } from '../checks/security-headers'
import { recordCheckObservations, recordInpObservation } from '../checks/observations'
import { runConsoleChecks, consoleObservations } from '../checks/console'
import { readScreenshotSnapshot, browserArtifactSchema, captureArtifactSchema, httpArtifactSchema, speedArtifactSchema, resourceArtifactSchema } from './snapshots'
import { serializeArtifact, readArtifact, TaskFailure } from './contracts'
import { checkArtifactSchema, commitFindings, commitCheckReceipt, flagSchema } from './results'
import type { TaskContext, TaskHandler } from './registry'
import { runSearchWorkflow, priorSearchReceipt, recordSearchVerifiers, combineSearchReceipts } from '../search/workflow'
import { runGoogleSearchForAudit } from '../search/google'
import { searchReceiptSchema } from '../search/contracts'
import { searchFindings } from '../search/registry'
import { collectSearchEvidence, missingDocument } from '../search/collect'
import { SEARCH_CHECK_DEFINITIONS } from '../search/registry'
import { CHECK_MODULES, CHECK_REGISTRY, CHECK_ASSERTIONS } from '../check-registry'
import { keyboardEvidenceSchema } from '../browser/keyboard-probe'
import { runKeyboardChecks } from '../checks/keyboard'
import { runTrackingChecks } from '../checks/tracking'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { suppressFlagsForPageRole } from '../suppression'
import { evaluateSearchIsolated } from './cpu'
import { executionWrite } from '../execution-ownership'
import { summarizeCheckAssertions } from '../checks/receipt'
import { capturedPageLinks, checkPublicLinks } from '../checks/public-links'
import { runInteractionChecks } from '../checks/interaction'
import { loadingDelayObservation, mobileLoadingDelayFlag } from '../checks/loading-evidence'
import { applyMotionObservation, motionObservationSchema } from '../checks/motion-evidence'
import { scopeRenderedPageEvidence } from '../checks/rendered-page-evidence'
import { runSecurityBasicsChecks, securityObservations } from '../checks/security'
import { assessPageResponse } from '../checks/page-response'
import { publicResponseRestriction } from '../browser/page-capture'
import { capturedHeadMetadata } from '../checks/head-metadata'

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
    validateResult: artifact => { checkArtifactSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const result = checkArtifactSchema.parse(artifact.data)
      await commitCheckReceipt(context, result.receipt, tx, context.input.device ? ':device:' + context.input.device : '')
      await commitFindings(context, artifact, tx)
    },
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
      const head = checkModule === 'metadata' || checkModule === 'og-image' ? capturedHeadMetadata(snapshot) : undefined
      let flags: import('../flag-types').DeterministicFlag[], assertions: import('../checks/assertion').CheckAssertion[] = []
      let applicable = true, complete: boolean | undefined, limitation: string | undefined
      let collectedAt: string | undefined
      let pageUrl = context.input.pageUrl
      const publicLinks = checkModule === 'seo' && spec?.verificationTarget?.kind === 'DIAGNOSTIC' && spec.verificationTarget.checkId.split('::page:')[0] === 'broken-internal-links'
      if (publicLinks) {
        const inventory = capturedPageLinks(snapshot, metadata ?? null)
        if (!inventory) throw new TaskFailure('PAGE_EVIDENCE_UNAVAILABLE', false)
        pageUrl = context.input.pageUrl
        const checked = await checkPublicLinks(pageUrl, inventory, context.deadline)
        flags = checked.flags; assertions = checked.assertions; complete = checked.complete; limitation = checked.limitation
        collectedAt = new Date().toISOString()
      } else if (checkModule === 'page-response') {
        const checked = assessPageResponse(pageUrl, response?.document)
        flags = checked.flags; assertions = checked.assertions; complete = checked.complete
        limitation = checked.limitation; collectedAt = checked.collectedAt
      } else if (checkModule === 'security') {
        if (!response || response.document.status === null) throw new TaskFailure('HTTP_COLLECTION_UNAVAILABLE', false)
        flags = runSecurityBasicsChecks(response.document.finalUrl, response.metadata)
        assertions = securityObservations(response.document.finalUrl, response.metadata)
        complete = assertions.every(assertion => assertion.complete === true)
        if (!complete) limitation = 'The connection protocol was observed. Declared resources require an inspectable HTML document.'
      } else if (checkModule === 'console') {
        if (!snapshot) throw new TaskFailure('CONSOLE_EVIDENCE_UNAVAILABLE', false)
        flags = runConsoleChecks(snapshot.consoleErrors, snapshot.consoleCoverage)
        assertions = consoleObservations(snapshot.consoleCoverage)
        complete = assertions.every(assertion => assertion.complete === true)
        limitation = 'Console inspection covers recorded desktop and mobile page-load windows. Later actions and unavailable captures remain outside this evidence.'
      } else if (checkModule === 'keyboard') {
        const task = dependency(context, 'keyboard')
        if (!task?.workResult) throw new TaskFailure('KEYBOARD_EVIDENCE_UNAVAILABLE', false)
        const evidence = keyboardEvidenceSchema.parse(readArtifact(task.workResult, 'keyboard').data)
        const checked = runKeyboardChecks(evidence)
        flags = checked.flags; assertions = checked.assertions
        applicable = evidence.candidateCount > 0 || (evidence.interactionCount ?? 0) > 0; complete = evidence.complete; pageUrl = evidence.scope?.pageUrl ?? evidence.pageUrl
        const copy = SITE_ACTION_COPY.execution.keyboard
        const opened = evidence.interactions?.filter(item => item.openedBy !== 'none').length ?? 0
        limitation = [`${evidence.steps.length} page controls exercised.`,
          ...(evidence.interactionCount ? [`${opened} of ${evidence.interactionCount} declared popup states opened for inspection.`] : []), copy.reasons[evidence.reason as keyof typeof copy.reasons] ?? copy.incomplete,
          ...evidence.limitations.map(key => copy.limitations[key as keyof typeof copy.limitations]).filter(Boolean), copy.scope].join(' ')
      } else if (checkModule === 'interaction') {
        if (!snapshot?.captureMetrics) throw new TaskFailure('RENDERED_METRICS_UNAVAILABLE', false)
        const motion = dependency(context, 'motion')
        if (motion?.workResult) snapshot.captureMetrics = applyMotionObservation(snapshot.captureMetrics, motionObservationSchema.parse(readArtifact(motion.workResult, 'motion').data))
        flags = runInteractionChecks(snapshot.captureMetrics, assertion => assertions.push(assertion))
        if (spec?.category) {
          flags = flags.filter(flag => Object.hasOwn(spec.checks, flag.checkId.split('::page:')[0]))
          assertions = assertions.filter(assertion => CHECK_ASSERTIONS[checkModule]?.[assertion.key]?.area === spec.category!.area ||
            CHECK_ASSERTIONS[checkModule]?.[assertion.key]?.verifies.some(id => Object.hasOwn(spec.checks, id)))
        }
        complete = assertions.filter(assertion => assertion.disposition !== 'observed').every(assertion => assertion.complete === true)
        limitation = 'Recorded mobile loading and reduced-motion observations, plus available desktop loading windows. Unavailable or unmatched source conditions cannot certify recovery.'
      } else if (checkModule === 'mobile-ux-quality' && spec?.verificationTarget?.kind === 'DIAGNOSTIC' && spec.verificationTarget.checkId.split('::page:')[0] === 'mobile-load-delay-content') {
        const window = snapshot?.captureMetrics?.loadExperience
        if (!window || window.device !== 'mobile') throw new TaskFailure('MOBILE_LOADING_EVIDENCE_UNAVAILABLE', false)
        const flag = mobileLoadingDelayFlag(window)
        flags = flag ? [flag] : []
        assertions = [loadingDelayObservation(window, 4000, 'mobile-loading-delay', true)]
        complete = assertions[0].complete === true
        limitation = 'This targeted execution evaluates the recorded mobile loading window. Other mobile layout responsibilities remain separate.'
      } else if (checkModule === 'measurement') {
        if (!snapshot) throw new TaskFailure('TRACKING_EVIDENCE_UNAVAILABLE', false)
        pageUrl = snapshot?.desktopFinalUrl ?? context.input.pageUrl
        const checked = runTrackingChecks(metadata ?? null, snapshot.tracking, pageUrl)
        flags = checked.flags; assertions = checked.assertions; complete = checked.complete; limitation = checked.limitation
      } else if (checkModule === 'performance' || checkModule === 'mobile') {
        const inpOnly = checkModule === 'performance' && context.input.device === 'mobile'
        const measurement = checkModule === 'mobile' || inpOnly ? speed?.mobile : speed?.desktop
        applicable = Boolean(measurement)
        if (!applicable) throw new TaskFailure('PERFORMANCE_EVIDENCE_UNAVAILABLE', false)
        flags = inpOnly ? runInpChecks(measurement!) : checkModule === 'mobile' ? runMobileChecks(measurement!, pageUrl) : runPerformanceChecks(measurement!, null, pageUrl)
        // Each receipt describes only its own device and responsibility.
        assertions = inpOnly ? [recordInpObservation(measurement!)] : recordCheckObservations(checkModule, { url: context.input.pageUrl,
          metadata: null, desktop: speed!.desktop, mobile: checkModule === 'mobile' ? speed!.mobile : null })
        complete = assertions.every(assertion => assertion.complete === true)
        if (!complete) limitation = inpOnly ? assertions[0].observed : 'PageSpeed did not provide all required performance measurements. Missing measurements remain unknown.'
      } else if (checkModule === 'security-headers') {
        if (response?.document.reason === 'public_access_challenge') throw new TaskFailure('PUBLIC_ACCESS_CHALLENGE', false)
        if (response && response.document.status !== null && publicResponseRestriction({
          body: response.document.body ?? '', headers: response.document.headers, status: response.document.status,
        })) throw new TaskFailure('PUBLIC_ACCESS_RESTRICTED', false)
        if (!response?.document.status) throw new TaskFailure('RESPONSE_EVIDENCE_UNAVAILABLE', false)
        flags = runSecurityHeaderChecks(response.document.finalUrl, response.document.headers)
        assertions = recordCheckObservations(checkModule, { url: response.document.finalUrl,
          metadata: null, headers: response.document.headers, desktop: null, mobile: null })
        complete = assertions.every(assertion => assertion.complete !== false)
        if (!complete) limitation = SECURITY_HEADER_LIMITATION
      } else {
        if (!metadata && definition.input === 'metadata' && !head) throw new TaskFailure('PAGE_EVIDENCE_UNAVAILABLE', false)
        if (definition.input === 'browser' && !snapshot?.captureMetrics) throw new TaskFailure('RENDERED_METRICS_UNAVAILABLE', false)
        const observedUrl = checkModule === 'security' ? response!.document.finalUrl : snapshot?.desktopFinalUrl ?? context.input.pageUrl
        const checked = await runAllChecks(observedUrl, metadata ?? null, null, null, snapshot?.consoleErrors ?? [], undefined,
          snapshot?.captureMetrics, response?.document.headers ?? snapshot?.responseHeaders, snapshot?.axeViolations, true, [checkModule], {
            deadline: context.deadline, head, renderedCopy: snapshot?.renderedCopy, accessibilityEvidence: snapshot?.accessibilityEvidence, renderedScope: snapshot?.renderedScope,
            ...(spec?.category ? { area: spec.category.area, allowedCheckIds: Object.keys(spec.checks) } : {}) })
        if (checked.failedModules.length) throw new TaskFailure('CHECK_EVALUATION_INTERRUPTED', true, undefined, true)
        if (checked.executions.length !== 1 || checked.executions[0].module !== checkModule) throw new TaskFailure('EVALUATOR_NOT_REGISTERED', false)
        flags = checked.flags
        assertions = checked.executions[0]?.assertions ?? []
        applicable = checked.executions[0]?.applicable === true
        complete = checked.executions[0]?.complete
        limitation = checked.executions[0]?.limitation
        collectedAt = checked.executions[0]?.collectedAt
      }
      // Other rendered modules already use the shared page evaluator adapter.
      if (checkModule === 'measurement') {
        const scoped = scopeRenderedPageEvidence({ module: checkModule, flags, assertions, desktop: snapshot?.renderedScope })
        flags = scoped.flags; assertions = scoped.assertions
      }
      flags = suppressFlagsForPageRole(flags, context.input.role)
        .map(flag => ({ ...flag, pageUrl }))
      const summary = summarizeCheckAssertions({ passed: flags.length === 0, complete, assertions })
      complete = summary.complete
      const sourceKind = checkModule === 'keyboard' ? 'keyboard' : definition.input === 'http' || checkModule === 'security' || checkModule === 'security-headers' ? 'http'
        : checkModule === 'performance' || checkModule === 'mobile' ? 'pagespeed' : 'browser'
      const sourceTask = dependency(context, sourceKind)
      if (!sourceTask?.workResult) throw new TaskFailure('ASSERTION_SOURCE_UNAVAILABLE', false)
      const source = readArtifact(sourceTask.workResult, sourceKind)
      const device = checkModule === 'mobile' || context.input.device === 'mobile' ? 'mobile' : 'desktop'
      return serializeArtifact('check', checkArtifactSchema.parse({ flags, receipt: {
        kind: 'site-module-check', version: 1, module: checkModule, passed: summary.passed, applicable, pageUrl, assertions,
        ...(complete !== undefined ? { complete, limitation } : {}),
        execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: definition.version, checkVersions: Object.fromEntries(selected),
          source: publicLinks || definition.input === 'http' ? 'http' : checkModule === 'console' ? 'browser-console' : checkModule === 'keyboard' ? 'keyboard' : checkModule === 'measurement' ? 'browser-network' : ['security', 'security-headers', 'auth-checkout', 'og-image'].includes(checkModule) ? 'http' : checkModule === 'performance' ? `pagespeed-${device}`
            : checkModule === 'mobile' ? 'pagespeed-mobile' : checkModule === 'accessibility' ? 'browser-accessibility' : 'rendered-dom',
          collectedAt: collectedAt ?? source.collectedAt },
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
      const input = { collectorVersion: 2 as const, auditId: context.audit.id, pageUrl: context.input.pageUrl,
        original: response?.document, renderedHtml: snapshot?.desktopHtml ?? null,
        renderedSearchSnapshot: snapshot?.collectionRestrictions?.length ? undefined : snapshot?.renderedSearchSnapshot,
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
