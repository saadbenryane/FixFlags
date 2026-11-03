import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { getAuditBrowser } from '../screenshot'
import { createAuditPage } from '../browser/page-session'
import { documentEvidenceWithheld } from '../browser/document-evidence'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE } from '../browser/capture-profile'
import { resolveAuditScanAccess } from '../scan-access-store'
import { runFlowScan, type FlowScanResult } from '../flow/run-flow-scan'
import { postClickMetricsSchema } from '../flow/post-click-probes'
import { runFlowChecks } from '../checks/flow'
import { POST_CLICK_CHECKS } from '../checks/flow-post-click'
import { DESTINATION_CONTENT_CHECKS } from '../checks/flow-destination-content'
import { assembleFlowModuleCheck } from '../checks/flow-module-receipt'
import { runNetworkEngagementChecks } from '../checks/network-engagement'
import { detectPagePurpose, needsFirstStep } from '../page-purpose'
import { runSlowReplay } from '../flow/slow-replay-probe'
import { runSlowReplayChecks, slowReplayAssertions } from '../checks/slow-replay'
import { slowActionIdentitySchema, slowReplayResultSchema } from '../flow/slow-replay-contract'
import { loadRecordedSlowActions, originalSlowActions } from '../flow/recorded-slow-actions'
import { browserEvidence } from './evaluators'
import { serializeArtifact, TaskFailure } from './contracts'
import { flagSchema, commitFindings, commitCheckReceipt } from './results'
import { executionWrite } from '../execution-ownership'
import { serializeFlowData } from '../flow/flow-url'
import type { TaskContext, TaskHandler } from './registry'
import { controlProgressSchema, nextControlProgress } from './control-progress'
import { commitObservation, nextObservationBatch, observationArtifact, observationBatchStart, observationProgressSchema } from './observation-progress'
import { runTrackingChecks } from '../checks/tracking'
import { trackingEvidenceSchema } from '../tracking/contracts'
import { checkReceiptSchema } from '../checks/receipt'
import { resolveAuditPipelineMode } from '../pipeline/mode'
import { probeFormValidation } from '../flow/form-probes'
import { formEvidenceSchema } from '../flow/form-evidence'
import { originalPageActionContexts, originalPageActionTargets } from '../flow/verification-context'
import { checkFormValidation } from '../checks/form-validation'
import { prisma } from '@/lib/db'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { diagnosticSourceWhere } from '@/lib/sites/domain/verification-source'
import { collectOverlayObservation } from '../browser/overlay-observation'
import { overlayObservationSchema, overlayAssertions, overlayTargetSchema, runObservedOverlayChecks, OVERLAY_CHECKS, scopedOverlayRule, scopedOverlayResult, overlayCheckReceipts, overlayReceiptScope, type OverlayTarget } from '../checks/overlay-evidence'
import { createOverlayInteractionRecorder } from '../browser/overlay-interaction'
import { capturePageKey } from '../browser/observation-scope'
import { PRIMARY_ACTION_CHECKS } from '../flow/primary-action-evidence'
import { collectMobileNavigation } from '../flow/mobile-navigation'
import { MOBILE_NAVIGATION_RULE, readMobileNavigationTarget, mobileNavigationAssertions, mobileNavigationFlags, mobileNavigationObservationSchema } from '../flow/mobile-navigation-evidence'

const flowSchema = z.object({ tracking: trackingEvidenceSchema.optional(), receipt: checkReceiptSchema.optional(),
  navigationObservations: z.array(mobileNavigationObservationSchema).max(4).optional(), navigationReceipt: checkReceiptSchema.optional(),
  overlayReceipts: z.array(checkReceiptSchema).max(100).optional(),
  flowReceipt: checkReceiptSchema.optional(), controlProgress: controlProgressSchema.optional(),
  formReceipt: checkReceiptSchema.optional(), formEvidence: formEvidenceSchema.optional(), flags: z.array(flagSchema).max(500), result: z.object({
  status: z.enum(['success', 'no_cta', 'unclickable', 'error_response', 'dead_end', 'external_leave', 'skipped', 'timeout']),
  steps: z.array(z.object({ label: z.string(), screenshotUrl: z.string().nullable(), url: z.string() }).strict()).max(30),
  finalUrl: z.string().url(), ctaText: z.string().nullable(), ctaHref: z.string().nullable(),
  postClickMetrics: postClickMetricsSchema.optional(),
}).strict() }).strict()
const slowSchema = z.object({ flags: z.array(flagSchema).max(500), result: slowReplayResultSchema,
  receipt: checkReceiptSchema.optional(), observationProgress: observationProgressSchema.optional() }).strict()

export const actionHandlers: TaskHandler[] = [
  { kind: 'overlays', replay: 'read_only', timeoutMs: 30_000,
    validateResult: artifact => { overlayObservationSchema.parse(artifact.data.observation); checkReceiptSchema.parse(artifact.data.receipt); z.array(flagSchema).parse(artifact.data.flags) },
    async commit(context, artifact, tx) {
      await commitCheckReceipt(context, checkReceiptSchema.parse(artifact.data.receipt), tx, ':device:' + context.input.device)
      await commitFindings(context, artifact, tx)
    },
    async evaluate(context) {
      const spec = readExecutionSpec(context.audit.executionSpec), target = spec?.verificationTarget
      const source = target?.kind === 'DIAGNOSTIC' ? await prisma.flag.findMany({ where: diagnosticSourceWhere(spec, context.audit.projectId),
        take: spec?.verificationSourceFlagIds?.length ?? 100, select: { evidenceTargets: true, verificationRule: true } }) : []
      const expectedTargets = source.flatMap(flag => scopedOverlayRule(flag.verificationRule) && Array.isArray(flag.evidenceTargets) ? flag.evidenceTargets.flatMap(value => {
        const parsed = z.object({ device: z.enum(['desktop', 'mobile']), context: z.string(), selector: z.string(), label: z.string() }).safeParse(value)
        if (!parsed.success || parsed.data.device !== context.input.device) return []
        const kind = parsed.data.context.split(':').at(-2)
        const target = overlayTargetSchema.safeParse({ kind, selector: parsed.data.selector, label: parsed.data.label, context: parsed.data.context })
        return target.success && target.data.context.split(':')[3] === 'page_load' ? [target.data] : []
      }) : [])
      const kinds = (Object.keys(OVERLAY_CHECKS) as Array<keyof typeof OVERLAY_CHECKS>).filter(kind => spec?.checks[OVERLAY_CHECKS[kind]])
      const observation = await collectOverlayObservation(await getAuditBrowser(), context.input.pageUrl, { device: context.input.device ?? 'desktop',
        deadline: context.deadline, scanAccess: await resolveAuditScanAccess(context.audit.id), expectedTargets, kinds })
      const assertions = overlayAssertions(observation)
      return serializeArtifact('overlays', { observation, flags: runObservedOverlayChecks(observation), receipt: checkReceiptSchema.parse({
        kind: 'site-module-check', version: 1, module: 'overlays', pageUrl: context.input.pageUrl, applicable: true,
        complete: assertions.every(assertion => assertion.complete === true), passed: assertions.every(assertion => assertion.passed), assertions,
        limitation: 'Initial viewport controls only. No control is clicked, no form is submitted and no consent decision is made.',
        execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
      }) })
    },
  },
  { kind: 'flow', replay: 'read_only', timeoutMs: 40_000, continuation: true,
    validateResult: artifact => { flowSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const { receipt, formReceipt, flowReceipt, overlayReceipts, navigationReceipt, controlProgress } = flowSchema.parse(artifact.data)
      if (context.input.verificationContexts) {
        const expected = nextControlProgress(context)
        if (!expected || !controlProgress || controlProgress.completed !== expected.completed || controlProgress.total !== expected.total ||
            controlProgress.context !== expected.context || Boolean(artifact.continuation) !== (expected.completed < expected.total))
          throw new TaskFailure('CONTROL_CHECKPOINT_INVALID', false)
        await commitObservation(context, artifact, tx, controlProgress.context ?? 'discovery')
        context = { ...context, input: { ...context.input, verificationContexts: undefined, verificationContext: controlProgress.context ?? undefined } }
      }
      if (receipt) await commitCheckReceipt(context, receipt, tx, context.input.module === 'pricing-navigation' ? ':phase:pricing_navigation' : ':phase:public_action')
      if (formReceipt) await commitCheckReceipt(context, formReceipt, tx)
      if (flowReceipt) await commitCheckReceipt(context, flowReceipt, tx, context.input.module === 'pricing-navigation' ? ':pricing-navigation' : '')
      if (navigationReceipt) await commitCheckReceipt(context, navigationReceipt, tx)
      for (const observed of overlayReceipts ?? []) await commitCheckReceipt(context, observed, tx, overlayReceiptScope(observed))
      await commitFindings(context, artifact, tx)
    },
    async evaluate(context) {
      const progress = nextControlProgress(context)
      if (!progress) return evaluateFlowObservation(context)
      const observed = await evaluateFlowObservation({ ...context, input: { ...context.input,
        verificationContexts: undefined, verificationContext: progress.context ?? undefined } })
      return { ...observed, ...(progress.completed < progress.total ? { continuation: true as const } : {}),
        data: { ...observed.data, controlProgress: progress } }
    }
  },
  { kind: 'slow-replay', replay: 'read_only', timeoutMs: 45_000, continuation: true,
    validateResult: artifact => { slowSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const data = slowSchema.parse(artifact.data)
      const start = observationBatchStart(context, artifact, 20)
      const committed = start === null ? artifact : await commitObservation(context, artifact, tx, 'batch:' + start)
      if (data.receipt) await commitCheckReceipt(context, data.receipt, tx, start === null ? '' : ':batch:' + start)
      await commitFindings(context, committed, tx)
      return committed
    },
    async evaluate(context) {
      if (await resolveAuditPipelineMode(context.audit.id) === 'TEASER') throw new TaskFailure('SLOW_REPLAY_NOT_APPLICABLE', false)
      const spec = readExecutionSpec(context.audit.executionSpec), target = spec?.verificationTarget
      const batch = await nextObservationBatch(context, 'slow-replay', slowActionIdentitySchema, async () => {
        const prior = target?.kind === 'DIAGNOSTIC' ? await prisma.flag.findMany({ where: diagnosticSourceWhere(spec, context.audit.projectId),
          take: spec?.verificationSourceFlagIds?.length ?? 100, select: { evidenceTargets: true, verificationRule: true, supportingObservations: true } }) : []
        return target?.kind === 'DIAGNOSTIC' ? originalSlowActions(prior, context.input.pageUrl)
        : context.audit.projectId && spec ? await loadRecordedSlowActions({ projectId: context.audit.projectId,
          environment: spec.environment, pageUrl: context.input.pageUrl, excludeAuditId: context.audit.id }) : []
      }, 20)
      const result = await runSlowReplay(await getAuditBrowser(), context.audit.id, context.input.pageUrl,
        { deadline: context.deadline, expectedActions: batch.members, pageKey: 'p' + context.input.position + '-g' + context.task.workGeneration, scanAccess: await resolveAuditScanAccess(context.audit.id) })
      // A page that never loaded has no timing to judge. An interruption can still be retried.
      if (result.reason !== 'navigation_unavailable' && (!result.navigationComplete || result.reason === 'interrupted'))
        throw new TaskFailure('SLOW_REPLAY_INTERRUPTED', true, undefined, true)
      const assertions = slowReplayAssertions(result), pageUrl = context.input.pageUrl
      const complete = assertions.every(assertion => assertion.complete === true)
      const collected = result.navigationComplete === true
      return observationArtifact('slow-replay', slowSchema.parse({ result, flags: runSlowReplayChecks(result).map(flag => ({ ...flag, pageUrl })),
        receipt: { kind: 'site-module-check', version: 1, module: 'slow-replay', pageUrl, applicable: true, complete,
          passed: complete && assertions.every(assertion => assertion.passed), assertions,
          limitation: collected
            ? 'Bounded top-level mobile viewport text, decoded main image and recognized-action timing on simulated 3G. Unclassified graphics, sampling gaps, missing controls and other devices remain separate or unknown.'
            : 'The slow connection page was not collected. Timing remains unknown.',
          execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
        } }), batch.progress)
    },
  },
]

async function evaluateFlowObservation(context: TaskContext) {
  const frozen = readExecutionSpec(context.audit.executionSpec), diagnostic = frozen?.verificationTarget
  const careContexts = frozen && (frozen.scope === 'SITE' || frozen.scope === 'CATEGORY')
    ? frozen.monitoringBehaviors?.find(scope => scope.pageUrl === context.input.pageUrl)?.actionContexts : undefined
  const excludedContexts = !context.input.verificationContext ? careContexts : undefined
  if (context.input.module === 'mobile-navigation') {
    const sources = diagnostic?.kind === 'DIAGNOSTIC' ? await prisma.flag.findMany({ where: diagnosticSourceWhere(frozen, context.audit.projectId),
      take: frozen?.verificationSourceFlagIds?.length ?? 100, select: { evidenceTargets: true, verificationRule: true } }) : []
    const targets = sources.flatMap(flag => flag.verificationRule === MOBILE_NAVIGATION_RULE && Array.isArray(flag.evidenceTargets)
      ? flag.evidenceTargets.flatMap(value => { const target = readMobileNavigationTarget(value); return target ? [target] : [] }) : [])
    const deadline = Math.min(context.deadline, Date.now() + 15_000)
    const session = await createAuditPage(await getAuditBrowser(), context.input.pageUrl, { profile: MOBILE_CAPTURE_PROFILE,
      journeySafe: true, scanAccess: await resolveAuditScanAccess(context.audit.id), deadline })
    try {
      const observed = await collectMobileNavigation(session.page, deadline,
        { ...(diagnostic?.kind === 'DIAGNOSTIC' ? { selectors: [...new Set(targets.map(target => target.selector))] } : {}),
          refusalCount: () => session.safetyRestrictions.length })
      const assertions = mobileNavigationAssertions(observed.observations)
      return serializeArtifact('flow', flowSchema.parse({ navigationObservations: observed.observations,
        flags: mobileNavigationFlags(observed.observations, context.input.pageUrl),
        result: { status: 'success', steps: [], finalUrl: session.page.url(), ctaText: null, ctaHref: null },
        navigationReceipt: { kind: 'site-module-check', version: 1, module: 'mobile-navigation', pageUrl: context.input.pageUrl,
          applicable: observed.applicable, complete: observed.complete, passed: observed.complete && assertions.every(assertion => assertion.passed), assertions,
          limitation: 'Bounded 375px navigation panels and local menu opening. Links are observed for visibility, never followed; unsupported controls, embedded documents and unobserved original links remain unknown.',
          execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } } }))
    } finally { session.disposeNetwork(); await session.page.context().close() }
  }
  const overlayDiagnostic = diagnostic?.kind === 'DIAGNOSTIC' && Object.values(OVERLAY_CHECKS).some(id => id === diagnostic.checkId.split('::page:')[0])
  const overlaySources = overlayDiagnostic && diagnostic?.kind === 'DIAGNOSTIC' ? await prisma.flag.findMany({ where: diagnosticSourceWhere(frozen, context.audit.projectId),
    take: frozen?.verificationSourceFlagIds?.length ?? 100, select: { evidenceTargets: true, verificationRule: true } }) : []
  const originalOverlays: OverlayTarget[] = overlaySources.flatMap(flag => scopedOverlayRule(flag.verificationRule) && Array.isArray(flag.evidenceTargets)
    ? flag.evidenceTargets.flatMap(value => {
      const parsed = z.object({ device: z.literal('desktop'), context: z.string(), selector: z.string(), label: z.string() }).safeParse(value)
      if (!parsed.success || !parsed.data.context.startsWith('overlay:' + capturePageKey(context.input.pageUrl) + ':')) return []
      const target = overlayTargetSchema.safeParse({ kind: parsed.data.context.split(':')[4], selector: parsed.data.selector, label: parsed.data.label, context: parsed.data.context })
      return target.success ? [target.data] : []
    }) : [])
  if (context.input.module === 'form-validation') {
    const token = randomUUID(), deadline = Math.min(context.deadline, Date.now() + 10_000)
    const spec = readExecutionSpec(context.audit.executionSpec), target = spec?.verificationTarget
    const sources = target?.kind === 'DIAGNOSTIC' && context.audit.projectId
      ? await prisma.flag.findMany({ where: diagnosticSourceWhere(spec, context.audit.projectId),
          take: spec?.verificationSourceFlagIds?.length ?? 100, select: { pageUrl: true, verificationRule: true, evidenceTargets: true, supportingObservations: true } }) : []
    const expectedTargets = careContexts && context.input.verificationContext ? [{ context: context.input.verificationContext,
      selector: 'form', label: 'Conversion form' }] : originalPageActionTargets(sources, context.input.pageUrl).flatMap(({ target: value }) => {
      const parsed = z.object({ context: z.string().startsWith('form:').max(160), selector: z.string().min(1).max(2000), label: z.string().min(1).max(160) }).safeParse(value)
      return parsed.success && (!context.input.verificationContext || parsed.data.context === context.input.verificationContext) ? [parsed.data] : []
    })
    let active = false, safetyRefused = false
    const session = await createAuditPage(await getAuditBrowser(), context.input.pageUrl, {
      profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, localFormValidationToken: token,
      scanAccess: await resolveAuditScanAccess(context.audit.id), deadline,
      allowLocalhost: process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_LOCALHOST === 'true',
      onSafetyRefusal: () => { if (active) safetyRefused = true },
    })
    try {
      active = true
      const recorder = createOverlayInteractionRecorder(session.page, { deadline, expectedTargets: originalOverlays.filter(target => target.context.split(':')[3].startsWith('form_validation')),
        restricted: () => safetyRefused || documentEvidenceWithheld(session.safetyRestrictions) })
      const probe = await probeFormValidation(session.page, { isolated: true, localValidationToken: token, deadline,
        safetyRefused: () => safetyRefused, expectedTargets, excludedContexts, unavailableDependencies: session.safetyRestrictions.length > 0, overlayRecorder: recorder, overlayOnly: overlayDiagnostic })
      const checked = checkFormValidation(probe.evidence)
      const overlays = scopedOverlayResult('form', probe.formOverlay, probe.formLabel, probe.formOverlayObservation).map(flag => ({ ...flag, pageUrl: probe.evidence?.pageUrl ?? context.input.pageUrl }))
      return serializeArtifact('flow', flowSchema.parse({ flags: [...checked.flags, ...overlays], formEvidence: probe.evidence,
        overlayReceipts: overlayCheckReceipts(recorder.observations(), { auditId: context.audit.id, taskId: context.task.id, collectedAt: new Date().toISOString() }),
        result: { status: 'success', steps: [], finalUrl: session.page.url(), ctaText: null, ctaHref: null },
        formReceipt: overlayDiagnostic ? undefined : { kind: 'site-module-check', version: 1, module: 'form-validation', pageUrl: probe.evidence?.pageUrl ?? context.input.pageUrl,
          applicable: checked.applicable, complete: checked.complete, passed: checked.complete && checked.flags.length === 0,
          assertions: checked.assertions, ...(!checked.complete ? { limitation: 'Empty-field form validation could not be observed safely.' } : {}),
          execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
        } }))
    } finally { session.disposeNetwork(); await session.page.context().close() }
  }
  const metadata = browserEvidence(context)?.metadata
  const target = readExecutionSpec(context.audit.executionSpec)?.verificationTarget
  const targetedPrimary = target?.kind === 'DIAGNOSTIC' && PRIMARY_ACTION_CHECKS.some(id => id === target.checkId.split('::page:')[0])
  const targetedLoading = target?.kind === 'DIAGNOSTIC' && POST_CLICK_CHECKS.includes(target.checkId.split('::page:')[0])
  const checkIdentity = target?.kind === 'DIAGNOSTIC' ? target.checkId.split('::page:')[0] : ''
  const targetedTrust = checkIdentity === 'flow-cta-destination-no-trust'
  const targetedContent = DESTINATION_CONTENT_CHECKS.includes(checkIdentity)
  const targetedPricing = target?.kind === 'DIAGNOSTIC' && target.checkId.split('::page:')[0] === 'flow-pricing-nav-broken'
  const pricingOnly = targetedPricing || context.input.module === 'pricing-navigation'
  let expectedActionContexts: string[] | undefined = context.input.verificationContext ? [context.input.verificationContext] : undefined
  if ((targetedPrimary || targetedLoading || targetedTrust || targetedContent || targetedPricing) && target?.kind === 'DIAGNOSTIC' && target.checkId.split('::page:')[0] !== 'flow-no-cta-found') {
    const scoped = frozen?.verificationScopes?.find(scope => scope.pageUrl === context.input.pageUrl)?.actionContexts
    const flags = scoped ? [] : await prisma.flag.findMany({ where: diagnosticSourceWhere(frozen, context.audit.projectId),
      take: frozen?.verificationSourceFlagIds?.length ?? 100, select: { pageUrl: true, verificationRule: true, evidenceTargets: true, supportingObservations: true } })
    expectedActionContexts = context.input.verificationContext ? [context.input.verificationContext]
      : scoped ?? originalPageActionContexts(flags, context.input.pageUrl)
  }
  const access = await resolveAuditScanAccess(context.audit.id)
  let protectedActionRefused = false
  const session = await createAuditPage(await getAuditBrowser(), context.input.pageUrl, {
    profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, scanAccess: access, deadline: context.deadline,
    allowLocalhost: process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_LOCALHOST === 'true',
    onSafetyRefusal: reason => { if (reason === 'protected_action_requires_fixture') protectedActionRefused = true },
  })
  try {
    session.setTrackingPhase('public_action')
    const result: FlowScanResult = await runFlowScan(session.page,
      context.audit.id, context.input.pageUrl,
      { pageKey: 'p' + context.input.position + '-g' + context.task.workGeneration, deadlineMs: Math.max(1, context.deadline - Date.now()),
        scanAccess: access, includeFormValidation: false, includeMobileNavigation: false, includePricingNavigation: false,
        ...(careContexts ? { expectedActionContexts, excludedActionContexts: excludedContexts } : {}),
        ...(overlayDiagnostic ? { captureSteps: false, overlayOnly: true, expectedOverlayTargets: originalOverlays.filter(target => ['primary_action', 'pricing_navigation', 'flow_form_validation'].some(phase => target.context.split(':')[3].startsWith(phase))),
          includeFormValidation: originalOverlays.some(target => target.context.split(':')[3].startsWith('flow_form_validation')),
          mode: !originalOverlays.some(target => ['pricing_navigation', 'flow_form_validation'].some(phase => target.context.split(':')[3].startsWith(phase))) ? 'primary' : undefined } : {}),
        ...(targetedPrimary || targetedLoading || targetedTrust || targetedContent ? { mode: targetedLoading || targetedTrust || targetedContent ? 'destination' : 'primary', captureSteps: false, expectedActionContexts } : {}),
        ...(pricingOnly ? { mode: 'pricing', captureSteps: false, expectedPricingContexts: expectedActionContexts } : {}) })
    if (!protectedActionRefused && result.status === 'skipped' && !result.actionEvidence && !overlayDiagnostic && !pricingOnly && !result.multiStep?.pricingEvidence) throw new TaskFailure('FLOW_EXECUTION_UNAVAILABLE', true, undefined, true)
    const tracking = session.tracking('public_action')
    const measured = runTrackingChecks(metadata ?? null, tracking, context.input.pageUrl)
    const purpose = metadata ? detectPagePurpose(metadata, context.input.pageUrl).purpose : null
    const actionRequired = purpose === null ? null : needsFirstStep(purpose)
    // A refused action cannot establish a broken destination. Keep the
    // independent observations and record the action's gap on its receipt.
    const actionFlags = runFlowChecks(result, purpose).filter(flag => !protectedActionRefused ||
      flag.checkId === 'flow-cta-404' && result.actionEvidence?.response === 'error')
    const flags = [...measured.flags, ...actionFlags,
      ...runNetworkEngagementChecks(session.networkFailures, session.formProbe)].map(flag => ({ ...flag, pageUrl: context.input.pageUrl }))
    const displayContext = (careContexts ?? frozen?.verificationScopes?.find(scope => scope.pageUrl === context.input.pageUrl)?.actionContexts)?.find(value => value.startsWith('flow:control:'))
    const ownsDisplay = careContexts && displayContext ? context.input.verificationContext === displayContext
      : !context.input.verificationContext || context.input.verificationContext === displayContext
    if (context.input.primary && !pricingOnly && ownsDisplay)
      await executionWrite(tx => tx.audit.update({ where: { id: context.audit.id }, data: { flowData: serializeFlowData(result) as never } }))
    const flowCheck = assembleFlowModuleCheck({ result, actionRequired, actionFlags, pricingOnly, targetedPricing, protectedActionRefused,
      delegatedDiscovery: Boolean(excludedContexts?.length) })
    return serializeArtifact('flow', flowSchema.parse({ flags, result: serializeFlowData(result), tracking, receipt: {
      kind: 'site-module-check', version: 1, module: 'measurement', pageUrl: context.input.pageUrl, applicable: true,
      passed: measured.flags.length === 0 && measured.complete, complete: measured.complete, limitation: measured.limitation, assertions: measured.assertions,
      execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() },
    }, overlayReceipts: overlayCheckReceipts(result.overlayObservations ?? [], { auditId: context.audit.id, taskId: context.task.id, collectedAt: new Date().toISOString() }),
    flowReceipt: overlayDiagnostic ? undefined : { kind: 'site-module-check', version: 1, module: 'flow', pageUrl: context.input.pageUrl, applicable: flowCheck.applicable,
      passed: flowCheck.passed, complete: flowCheck.complete, assertions: flowCheck.assertions,
      limitation: 'Public action observations cover the recorded page and control. Unsupported responses, changed controls, unsafe actions and intended business completion remain separate or unknown.',
      execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
    } }))
  } finally { session.disposeNetwork(); await session.page.context().close() }
}
