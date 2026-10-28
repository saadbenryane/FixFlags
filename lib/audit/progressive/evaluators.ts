import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { runAllChecks } from '../checks'
import { isUnresolvedPublicRedirect } from '../redirect-evidence'
import { runPerformanceChecks, runInpChecks } from '../checks/performance'
import { runMobileChecks } from '../checks/mobile'
import { runSecurityHeaderChecks, SECURITY_HEADER_LIMITATION, SECURITY_HEADER_WITHHELD_LIMITATION } from '../checks/security-headers'
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
import { CHECK_MODULES, CHECK_REGISTRY } from '../check-registry'
import { keyboardEvidenceSchema } from '../browser/keyboard-probe'
import { runKeyboardChecks } from '../checks/keyboard'
import { runTrackingChecks } from '../checks/tracking'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { suppressFlagsForPageRole } from '../suppression'
import { evaluateSearchIsolated } from './cpu'
import { executionWrite } from '../execution-ownership'
import { scopeCheckEvidence, summarizeCheckAssertions } from '../checks/receipt'
import { capturedPageLinks, checkPublicLinks, missingPublicLinkEvidence } from '../checks/public-links'
import { runInteractionChecks } from '../checks/interaction'
import { loadingDelayObservation, mobileLoadingDelayFlag } from '../checks/loading-evidence'
import { applyMotionObservation, motionObservationSchema } from '../checks/motion-evidence'
import { scopeRenderedPageEvidence } from '../checks/rendered-page-evidence'
import { assessPageResponse } from '../checks/page-response'
import { publicResponseRestriction } from '../browser/page-capture'
import { renderedDocumentForSearch } from '../browser/document-evidence'
import { capturedHeadMetadata } from '../checks/head-metadata'
import { nativeHttpCollection } from '../native-http-evidence'

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
      const evidenceScope = spec?.category ? { area: spec.category.area, allowedCheckIds: Object.keys(spec.checks) } : undefined
      const selected = Object.entries(spec?.checks ?? {}).filter(([id]) => CHECK_REGISTRY[id]?.module === checkModule)
      if (!selected.length) throw new TaskFailure('CHECK_NOT_ADMITTED', false)
      if (selected.some(([id, version]) => CHECK_REGISTRY[id]?.version !== version))
        throw new TaskFailure('CHECK_VERSION_UNAVAILABLE', false)
      const browser = browserEvidence(context), response = httpEvidence(context), speed = speedEvidence(context)
      const nativeHttp = nativeHttpCollection(context.replayHttpEvidence)
      const metadata = definition.input === 'http' ? response?.metadata : browser?.metadata
      const snapshot = browser ? readScreenshotSnapshot(browser.snapshot) : null
      const head = checkModule === 'metadata' || checkModule === 'og-image' ? capturedHeadMetadata(snapshot) : undefined
      let flags: import('../flag-types').DeterministicFlag[], assertions: import('../checks/assertion').CheckAssertion[] = []
      let applicable = true, complete: boolean | undefined, limitation: string | undefined
      let collectedAt: string | undefined
      let collectedDestinations = false
      let pageUrl = context.input.pageUrl
      const publicLinks = checkModule === 'seo' && spec?.verificationTarget?.kind === 'DIAGNOSTIC' && spec.verificationTarget.checkId.split('::page:')[0] === 'broken-internal-links'
      if (publicLinks) {
        const inventory = capturedPageLinks(snapshot, metadata ?? null)
        pageUrl = context.input.pageUrl
        // A capture without a link list has no destination to judge. Do not fetch or invent a broken link.
        if (!inventory) {
          const missing = missingPublicLinkEvidence()
          flags = missing.flags; assertions = missing.assertions; complete = missing.complete; limitation = missing.limitation
        } else {
          const checked = await checkPublicLinks(pageUrl, inventory, context.deadline, nativeHttp.options.openDestination)
          flags = checked.flags; assertions = checked.assertions; complete = checked.complete; limitation = checked.limitation
          collectedAt = nativeHttp.options.collectedAt(); collectedDestinations = true
        }
      } else if (checkModule === 'page-response') {
        const checked = assessPageResponse(pageUrl, response?.document)
        flags = checked.flags; assertions = checked.assertions; complete = checked.complete
        limitation = checked.limitation; collectedAt = checked.collectedAt
      } else if (checkModule === 'console') {
        flags = runConsoleChecks(snapshot?.consoleErrors ?? [], snapshot?.consoleCoverage)
        assertions = consoleObservations(snapshot?.consoleCoverage)
        complete = assertions.every(assertion => assertion.complete === true)
        limitation = snapshot
          ? 'Console inspection covers recorded desktop and mobile page-load windows. Later actions and unavailable captures remain outside this evidence.'
          : 'Console collection was not captured. Page-load errors remain unknown.'
      } else if (checkModule === 'keyboard') {
        const task = dependency(context, 'keyboard')
        if (!task?.workResult) {
          flags = []
          const unknown = 'Keyboard navigation was not collected. This behavior remains unknown.'
          assertions = [
            { key: 'focus-styles', name: 'Focus indicators', expected: 'The recorded controls have an observable focus outline or style change', observed: unknown, passed: false, complete: false },
            { key: 'keyboard-exit', name: 'Keyboard navigation exit', expected: 'Tab can leave the recorded controls without an unresolved cycle', observed: unknown, passed: false, complete: false },
            { key: 'tab-sequence', name: 'Recorded keyboard order', expected: 'The exercised Tab sequence has no positive-tabindex backward jump', observed: unknown, passed: false, complete: false },
          ]
          applicable = true
          complete = false
          limitation = 'Keyboard navigation was not collected. Focus, tab order, and popup behavior remain unknown.'
        } else {
          const evidence = keyboardEvidenceSchema.parse(readArtifact(task.workResult, 'keyboard').data)
          const checked = runKeyboardChecks(evidence)
          flags = checked.flags; assertions = checked.assertions
          applicable = evidence.candidateCount > 0 || (evidence.interactionCount ?? 0) > 0; complete = evidence.complete; pageUrl = evidence.scope?.pageUrl ?? evidence.pageUrl
          const copy = SITE_ACTION_COPY.execution.keyboard
          const opened = evidence.interactions?.filter(item => item.openedBy !== 'none').length ?? 0
          limitation = [`${evidence.steps.length} page controls exercised.`,
            ...(evidence.interactionCount ? [`${opened} of ${evidence.interactionCount} declared popup states opened for inspection.`] : []), copy.reasons[evidence.reason as keyof typeof copy.reasons] ?? copy.incomplete,
            ...evidence.limitations.map(key => copy.limitations[key as keyof typeof copy.limitations]).filter(Boolean), copy.scope].join(' ')
        }
      } else if (checkModule === 'interaction' && snapshot?.captureMetrics) {
        const motion = dependency(context, 'motion')
        if (motion?.workResult) snapshot.captureMetrics = applyMotionObservation(snapshot.captureMetrics, motionObservationSchema.parse(readArtifact(motion.workResult, 'motion').data))
        flags = runInteractionChecks(snapshot.captureMetrics, assertion => assertions.push(assertion))
        const admitted = scopeCheckEvidence({ module: checkModule, flags, assertions, scope: evidenceScope })
        flags = admitted.flags; assertions = admitted.assertions
        complete = assertions.filter(assertion => assertion.disposition !== 'observed').every(assertion => assertion.complete === true)
        limitation = 'Recorded mobile loading and reduced-motion observations, plus available desktop loading windows. Unavailable or unmatched source conditions cannot certify recovery.'
      } else if (checkModule === 'mobile-ux-quality' && spec?.verificationTarget?.kind === 'DIAGNOSTIC' && spec.verificationTarget.checkId.split('::page:')[0] === 'mobile-load-delay-content') {
        const window = snapshot?.captureMetrics?.loadExperience
        if (!window || window.device !== 'mobile') {
          flags = []
          assertions = [{ key: 'mobile-loading-delay', name: 'Mobile loading delay', expected: 'Recorded mobile evidence supports this observation',
            observed: 'Mobile loading was not collected. The delay remains unknown.', passed: false, complete: false }]
          complete = false
        } else {
          const flag = mobileLoadingDelayFlag(window)
          flags = flag ? [flag] : []
          assertions = [loadingDelayObservation(window, 4000, 'mobile-loading-delay', true)]
          complete = assertions[0].complete === true
        }
        limitation = 'This targeted execution evaluates the recorded mobile loading window. Other mobile layout responsibilities remain separate.'
      } else if (checkModule === 'measurement') {
        pageUrl = snapshot?.desktopFinalUrl ?? context.input.pageUrl
        const checked = runTrackingChecks(metadata ?? null, snapshot?.tracking, pageUrl)
        flags = checked.flags; assertions = checked.assertions; complete = checked.complete; limitation = checked.limitation
      } else if (checkModule === 'performance' || checkModule === 'mobile') {
        const inpOnly = checkModule === 'performance' && context.input.device === 'mobile'
        const measurement = checkModule === 'mobile' || inpOnly ? speed?.mobile : speed?.desktop
        if (!measurement) {
          flags = []
          applicable = true
          assertions = inpOnly
            ? [{ key: 'inp', name: 'Mobile field responsiveness', expected: 'CrUX p75 INP is at most 200ms',
              observed: 'No CrUX INP measurement is available. Current responsiveness remains unknown.',
              passed: false, complete: false, disposition: 'observed' }]
            : recordCheckObservations(checkModule, { url: context.input.pageUrl, metadata: null, desktop: null, mobile: null })
          complete = false
          limitation = inpOnly ? assertions[0].observed : 'PageSpeed did not provide all required performance measurements. Missing measurements remain unknown.'
        } else {
          applicable = true
          flags = inpOnly ? runInpChecks(measurement) : checkModule === 'mobile' ? runMobileChecks(measurement, pageUrl) : runPerformanceChecks(measurement, null, pageUrl)
          // Each receipt describes only its own device and responsibility.
          assertions = inpOnly ? [recordInpObservation(measurement)] : recordCheckObservations(checkModule, { url: context.input.pageUrl,
            metadata: null, desktop: speed!.desktop, mobile: checkModule === 'mobile' ? speed!.mobile : null })
          const admitted = scopeCheckEvidence({ module: checkModule, flags, assertions, scope: evidenceScope })
          flags = admitted.flags; assertions = admitted.assertions
          complete = assertions.every(assertion => assertion.complete === true)
          if (!complete) limitation = inpOnly ? assertions[0].observed : 'PageSpeed did not provide all required performance measurements. Missing measurements remain unknown.'
        }
      } else if (checkModule === 'security-headers') {
        const document = response?.document
        // A challenge, unfinished redirect, or access restriction is not the origin configuration.
        const withheld = Boolean(document && (isUnresolvedPublicRedirect(document) || document.reason === 'public_access_challenge' ||
          (document.status !== null && publicResponseRestriction({ body: document.body ?? '', headers: document.headers, status: document.status }))))
        // A settled fetch with no status was not collected. Keep the check incomplete
        // instead of aborting it. An empty collected map is a real absence and still flags.
        if (!document?.status || withheld) {
          pageUrl = document?.finalUrl ?? context.input.pageUrl
          flags = []
          assertions = recordCheckObservations(checkModule, { url: pageUrl, metadata: null, headers: null, desktop: null, mobile: null })
          complete = false
          limitation = withheld ? SECURITY_HEADER_WITHHELD_LIMITATION : SECURITY_HEADER_LIMITATION
        } else {
          flags = runSecurityHeaderChecks(document.finalUrl, document.headers)
          assertions = recordCheckObservations(checkModule, { url: document.finalUrl,
            metadata: null, headers: document.headers, desktop: null, mobile: null })
          complete = assertions.every(assertion => assertion.complete !== false)
          if (!complete) limitation = SECURITY_HEADER_LIMITATION
        }
      } else {
        // A completed capture can omit parsed metadata or browser metrics. Record that gap.
        const observedUrl = definition.input === 'http' ? context.input.pageUrl : snapshot?.desktopFinalUrl ?? context.input.pageUrl
        const checked = await runAllChecks(observedUrl, metadata ?? null, null, null, snapshot?.consoleErrors ?? [], undefined,
          snapshot?.captureMetrics, response?.document.headers ?? snapshot?.responseHeaders, snapshot?.axeViolations, true, [checkModule], {
            deadline: context.deadline, destinations: nativeHttp.options, head, publicDocument: response?.document, renderedCopy: snapshot?.renderedCopy, accessibilityEvidence: snapshot?.accessibilityEvidence, mobileAccessibility: snapshot?.mobileAccessibility, renderedScope: snapshot?.renderedScope,
            ...evidenceScope })
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
      const sourceKind = checkModule === 'keyboard' ? 'keyboard' : definition.input === 'http' || checkModule === 'security-headers' ? 'http'
        : checkModule === 'performance' || checkModule === 'mobile' ? 'pagespeed' : 'browser'
      const sourceTask = dependency(context, sourceKind)
      const source = sourceTask?.workResult ? readArtifact(sourceTask.workResult, sourceKind) : null
      // A missing collector result is the observation. Do not publish findings or a collection time for it.
      if (!source) {
        flags = []
        complete = false
        applicable = true
        limitation ??= 'The evidence for this check was not collected. The result remains unknown.'
      }
      const summary = summarizeCheckAssertions({ passed: flags.length === 0, complete, assertions })
      complete = summary.complete
      const evidenceCollectedAt = collectedAt ?? source?.collectedAt
      const device = checkModule === 'mobile' || context.input.device === 'mobile' ? 'mobile' : 'desktop'
      return serializeArtifact('check', checkArtifactSchema.parse({ flags, httpEvidence: nativeHttp.snapshot(), receipt: {
        kind: 'site-module-check', version: 1, module: checkModule, passed: summary.passed, applicable, pageUrl, assertions,
        ...(complete !== undefined ? { complete, limitation } : {}),
        ...(evidenceCollectedAt ? { execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: definition.version, checkVersions: Object.fromEntries(selected),
          source: collectedDestinations || definition.input === 'http' ? 'http' : checkModule === 'console' ? 'browser-console' : checkModule === 'keyboard' ? 'keyboard' : checkModule === 'measurement' ? 'browser-network' : ['security', 'security-headers', 'auth-checkout', 'og-image'].includes(checkModule) ? 'http' : checkModule === 'performance' ? `pagespeed-${device}`
            : checkModule === 'mobile' ? 'pagespeed-mobile' : checkModule === 'accessibility' ? 'browser-accessibility' : 'rendered-dom',
          collectedAt: evidenceCollectedAt } } : {}),
      } }))
    },
  },
  { kind: 'search', replay: 'read_only', timeoutMs: 35_000,
    validateResult: artifact => { searchArtifactSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const { receipt } = searchArtifactSchema.parse(artifact.data)
      const receiptModule = !context.input.module || context.input.module === 'summary' ? 'search' : context.input.module
      if (context.input.module !== 'summary') await tx.auditVerificationReceipt.upsert({
        where: { auditId_targetKey_scopeKey: { auditId: context.audit.id, targetKey: 'module:' + receiptModule, scopeKey: 'page:' + receipt.pageUrl } },
        create: { taskId: context.task.id, auditId: context.audit.id, targetKey: 'module:' + receiptModule, scopeKey: 'page:' + receipt.pageUrl,
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
      const rendered = renderedDocumentForSearch(snapshot)
      const input = { collectorVersion: 2 as const, auditId: context.audit.id, pageUrl: context.input.pageUrl,
        original: response?.document, renderedHtml: rendered.renderedHtml,
        renderedSearchSnapshot: rendered.renderedSearchSnapshot,
        renderedCollectedAt: dependency(context, 'browser')?.workResult ? readArtifact(dependency(context, 'browser')!.workResult, 'browser').collectedAt : undefined,
        renderedComplete: rendered.renderedComplete, headers: snapshot?.responseHeaders ?? undefined,
        finalUrl: snapshot?.desktopFinalUrl, status: snapshot?.desktopHttpStatus, deadline: context.deadline, cache,
        privateCapture: Boolean(context.audit.scanAccessEncrypted), collectCanonicalTargets: !evaluator || evaluator === 'canonical' }
      if (!evaluator) {
        const result = await runSearchWorkflow({ ...input,
          evaluate: (evidence, previous) => evaluateSearchIsolated(evidence, previous, context.deadline) })
        return serializeArtifact('search', searchArtifactSchema.parse({ receipt: result.receipt, flags: result.findings }))
      }
      const evidence = await collectSearchEvidence(input)
      const previous = await priorSearchReceipt(context.audit.id, context.input.pageUrl, evaluator)
      const observations = await evaluateSearchIsolated(evidence, previous, context.deadline, [evaluator])
      const complete = !observations.some(item => item.disposition === 'unknown') &&
        (!['indexing', 'discovery'].includes(evaluator) || evidence.sitemapsComplete)
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
        requireConfiguredEvidence: readExecutionSpec(context.audit.executionSpec)?.scope === 'DIAGNOSTIC',
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
