import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { getAuditBrowser } from '../screenshot'
import { createAuditPage } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE } from '../browser/capture-profile'
import { resolveAuditScanAccess } from '../scan-access-store'
import { runFlowScan, type FlowScanResult } from '../flow/run-flow-scan'
import { postClickMetricsSchema } from '../flow/post-click-probes'
import { runFlowChecks } from '../checks/flow'
import { POST_CLICK_CHECKS, POST_CLICK_VERIFICATION_RULE, postClickActionContext } from '../checks/flow-post-click'
import { destinationTrustActionContext, DESTINATION_TRUST_VERIFICATION_RULE } from '../checks/flow-destination-trust'
import { destinationContentActionContext, DESTINATION_CONTENT_CHECKS, DESTINATION_CONTENT_VERIFICATION_RULE } from '../checks/flow-destination-content'
import { assembleFlowModuleCheck } from '../checks/flow-module-receipt'
import { runNetworkEngagementChecks } from '../checks/network-engagement'
import { detectPagePurpose, needsFirstStep } from '../page-purpose'
import { runSlowReplay } from '../flow/slow-replay-probe'
import { runSlowReplayChecks, slowReplayAssertions } from '../checks/slow-replay'
import { readSlowActionTargets, slowActionContextSchema, slowReplayResultSchema, SLOW_REPLAY_VERIFICATION_RULE } from '../flow/slow-replay-contract'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import { browserEvidence } from './evaluators'
import { serializeArtifact, TaskFailure } from './contracts'
import { flagSchema, commitFindings, commitCheckReceipt } from './results'
import { executionWrite } from '../execution-ownership'
import { serializeFlowData } from '../flow/flow-url'
import type { TaskHandler } from './registry'
import { runTrackingChecks } from '../checks/tracking'
import { trackingEvidenceSchema } from '../tracking/contracts'
import { checkReceiptSchema } from '../checks/receipt'
import { resolveAuditPipelineMode } from '../pipeline/mode'
import { probeFormValidation } from '../flow/form-probes'
import { formEvidenceSchema } from '../flow/form-evidence'
import { checkFormValidation } from '../checks/form-validation'
import { prisma } from '@/lib/db'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { collectOverlayObservation } from '../browser/overlay-observation'
import { overlayObservationSchema, overlayAssertions, overlayTargetSchema, runObservedOverlayChecks, OVERLAY_CHECKS, scopedOverlayRule, scopedOverlayResult, overlayCheckReceipts, overlayReceiptScope, type OverlayTarget } from '../checks/overlay-evidence'
import { createOverlayInteractionRecorder } from '../browser/overlay-interaction'
import { capturePageKey } from '../browser/observation-scope'
import { PRIMARY_ACTION_CHECKS, PRIMARY_ACTION_VERIFICATION_RULE } from '../flow/primary-action-evidence'
import { PRICING_NAVIGATION_RULE, pricingNavigationTargetSchema } from '../flow/pricing-navigation-evidence'
import { collectMobileNavigation } from '../flow/mobile-navigation'
import { MOBILE_NAVIGATION_RULE, readMobileNavigationTarget, mobileNavigationAssertions, mobileNavigationFlags, mobileNavigationObservationSchema } from '../flow/mobile-navigation-evidence'

const flowSchema = z.object({ tracking: trackingEvidenceSchema.optional(), receipt: checkReceiptSchema.optional(),
  navigationObservations: z.array(mobileNavigationObservationSchema).max(4).optional(), navigationReceipt: checkReceiptSchema.optional(),
  overlayReceipts: z.array(checkReceiptSchema).max(100).optional(),
  flowReceipt: checkReceiptSchema.optional(),
  formReceipt: checkReceiptSchema.optional(), formEvidence: formEvidenceSchema.optional(), flags: z.array(flagSchema).max(500), result: z.object({
  status: z.enum(['success', 'no_cta', 'unclickable', 'error_response', 'dead_end', 'external_leave', 'skipped', 'timeout']),
  steps: z.array(z.object({ label: z.string(), screenshotUrl: z.string().nullable(), url: z.string() }).strict()).max(30),
  finalUrl: z.string().url(), ctaText: z.string().nullable(), ctaHref: z.string().nullable(),
  postClickMetrics: postClickMetricsSchema.optional(),
}).strict() }).strict()
const slowSchema = z.object({ flags: z.array(flagSchema).max(500), result: slowReplayResultSchema,
  receipt: checkReceiptSchema.optional() }).strict()

export const actionHandlers: TaskHandler[] = [
  { kind: 'overlays', replay: 'read_only', timeoutMs: 30_000,
    validateResult: artifact => { overlayObservationSchema.parse(artifact.data.observation); checkReceiptSchema.parse(artifact.data.receipt); z.array(flagSchema).parse(artifact.data.flags) },
    async commit(context, artifact, tx) {
      await commitCheckReceipt(context, checkReceiptSchema.parse(artifact.data.receipt), tx, ':device:' + context.input.device)
      await commitFindings(context, artifact, tx)
    },
    async evaluate(context) {
      const spec = readExecutionSpec(context.audit.executionSpec), target = spec?.verificationTarget
      const source = target?.kind === 'DIAGNOSTIC' ? await prisma.flag.findMany({ where: { auditId: target.parentAuditId,
        audit: { projectId: context.audit.projectId }, checkId: target.checkId }, take: 100, select: { evidenceTargets: true, verificationRule: true } }) : []
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
  { kind: 'flow', replay: 'read_only', timeoutMs: 40_000,
    validateResult: artifact => { flowSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const { receipt, formReceipt, flowReceipt, overlayReceipts, navigationReceipt } = flowSchema.parse(artifact.data)
      if (receipt) await commitCheckReceipt(context, receipt, tx, context.input.module === 'pricing-navigation' ? ':phase:pricing_navigation' : ':phase:public_action')
      if (formReceipt) await commitCheckReceipt(context, formReceipt, tx)
      if (flowReceipt) await commitCheckReceipt(context, flowReceipt, tx, context.input.module === 'pricing-navigation' ? ':pricing-navigation' : '')
      if (navigationReceipt) await commitCheckReceipt(context, navigationReceipt, tx)
      for (const observed of overlayReceipts ?? []) await commitCheckReceipt(context, observed, tx, overlayReceiptScope(observed))
      await commitFindings(context, artifact, tx)
    },
    async evaluate(context) {
      const frozen = readExecutionSpec(context.audit.executionSpec), diagnostic = frozen?.verificationTarget
      if (context.input.module === 'mobile-navigation') {
        const sources = diagnostic?.kind === 'DIAGNOSTIC' ? await prisma.flag.findMany({ where: { auditId: diagnostic.parentAuditId,
          audit: { projectId: context.audit.projectId }, checkId: diagnostic.checkId }, take: 100, select: { evidenceTargets: true, verificationRule: true } }) : []
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
      const overlaySources = overlayDiagnostic && diagnostic?.kind === 'DIAGNOSTIC' ? await prisma.flag.findMany({ where: { auditId: diagnostic.parentAuditId,
        audit: { projectId: context.audit.projectId }, checkId: diagnostic.checkId }, take: 100, select: { evidenceTargets: true, verificationRule: true } }) : []
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
          ? await prisma.flag.findMany({ where: { auditId: target.parentAuditId, audit: { projectId: context.audit.projectId }, checkId: target.checkId },
              take: 100, select: { evidenceTargets: true } }) : []
        const expectedTargets = sources.flatMap(source => Array.isArray(source.evidenceTargets) ? source.evidenceTargets.flatMap(value => {
          const parsed = z.object({ context: z.string().startsWith('form:').max(160), selector: z.string().min(1).max(2000), label: z.string().min(1).max(160) }).safeParse(value)
          return parsed.success ? [parsed.data] : []
        }) : [])
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
            restricted: () => safetyRefused || session.safetyRestrictions.length > 0 })
          const probe = await probeFormValidation(session.page, { isolated: true, localValidationToken: token, deadline,
            safetyRefused: () => safetyRefused, expectedTargets, unavailableDependencies: session.safetyRestrictions.length > 0, overlayRecorder: recorder, overlayOnly: overlayDiagnostic })
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
      let expectedActionContexts: string[] | undefined
      if ((targetedPrimary || targetedLoading || targetedTrust || targetedContent || targetedPricing) && target?.kind === 'DIAGNOSTIC' && target.checkId.split('::page:')[0] !== 'flow-no-cta-found') {
        const flags = await prisma.flag.findMany({ where: { auditId: target.parentAuditId, audit: { projectId: context.audit.projectId }, checkId: target.checkId },
          take: 100, select: { evidenceTargets: true, verificationRule: true } })
        const contexts = flags.flatMap(flag => !Array.isArray(flag.evidenceTargets) ? [] : flag.evidenceTargets.flatMap(value => {
          if (targetedPricing) {
            const parsed = pricingNavigationTargetSchema.safeParse(value)
            return flag.verificationRule === PRICING_NAVIGATION_RULE && parsed.success ? [parsed.data.context] : []
          }
          if (targetedLoading) {
            const context = flag.verificationRule === POST_CLICK_VERIFICATION_RULE ? postClickActionContext(value) : undefined
            return context ? [context] : []
          }
          if (targetedTrust || targetedContent) {
            const context = targetedTrust
              ? flag.verificationRule === DESTINATION_TRUST_VERIFICATION_RULE ? destinationTrustActionContext(value) : undefined
              : flag.verificationRule === DESTINATION_CONTENT_VERIFICATION_RULE ? destinationContentActionContext(value) : undefined
            return context ? [context] : []
          }
          if (flag.verificationRule !== PRIMARY_ACTION_VERIFICATION_RULE) return []
          const parsed = z.object({ context: z.string().regex(/^flow:control:[a-f0-9]{64}$/) }).safeParse(value)
          return parsed.success ? [parsed.data.context] : []
        }))
        expectedActionContexts = contexts.length ? [...new Set(contexts)] : []
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
            ...(overlayDiagnostic ? { captureSteps: false, overlayOnly: true, expectedOverlayTargets: originalOverlays.filter(target => ['primary_action', 'pricing_navigation', 'flow_form_validation'].some(phase => target.context.split(':')[3].startsWith(phase))),
              includeFormValidation: originalOverlays.some(target => target.context.split(':')[3].startsWith('flow_form_validation')),
              mode: !originalOverlays.some(target => ['pricing_navigation', 'flow_form_validation'].some(phase => target.context.split(':')[3].startsWith(phase))) ? 'primary' : undefined } : {}),
            ...(targetedPrimary || targetedLoading || targetedTrust || targetedContent ? { mode: targetedLoading || targetedTrust || targetedContent ? 'destination' : 'primary', captureSteps: false, expectedActionContexts } : {}),
            ...(pricingOnly ? { mode: 'pricing', captureSteps: false, expectedPricingContexts: expectedActionContexts } : {}) })
        if (protectedActionRefused) throw new TaskFailure('PROTECTED_ACTION_REQUIRES_FIXTURE', false)
        if (result.status === 'skipped' && !result.actionEvidence && !overlayDiagnostic && !pricingOnly && !result.multiStep?.pricingEvidence) throw new TaskFailure('FLOW_EXECUTION_UNAVAILABLE', true, undefined, true)
        const tracking = session.tracking('public_action')
        const measured = runTrackingChecks(metadata ?? null, tracking, context.input.pageUrl)
        const purpose = metadata ? detectPagePurpose(metadata, context.input.pageUrl).purpose : null
        const actionRequired = purpose === null ? null : needsFirstStep(purpose)
        const actionFlags = runFlowChecks(result, purpose)
        const flags = [...measured.flags, ...actionFlags,
          ...runNetworkEngagementChecks(session.networkFailures, session.formProbe)].map(flag => ({ ...flag, pageUrl: context.input.pageUrl }))
        if (context.input.primary && !pricingOnly) await executionWrite(tx => tx.audit.update({ where: { id: context.audit.id }, data: { flowData: serializeFlowData(result) as never } }))
        const flowCheck = assembleFlowModuleCheck({ result, actionRequired, actionFlags, pricingOnly, targetedPricing })
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
    },
  },
  { kind: 'slow-replay', replay: 'read_only', timeoutMs: 45_000,
    validateResult: artifact => { slowSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      await commitFindings(context, artifact, tx)
      const data = slowSchema.parse(artifact.data)
      if (data.receipt) await commitCheckReceipt(context, data.receipt, tx)
    },
    async evaluate(context) {
      if (await resolveAuditPipelineMode(context.audit.id) === 'TEASER') throw new TaskFailure('SLOW_REPLAY_NOT_APPLICABLE', false)
      const spec = readExecutionSpec(context.audit.executionSpec), target = spec?.verificationTarget
      const prior = context.audit.projectId ? await prisma.flag.findMany({ where: {
        audit: { projectId: context.audit.projectId, ...(target?.kind === 'DIAGNOSTIC' ? {} : {
          executionSpec: { path: ['environment'], equals: spec?.environment ?? 'production' },
        }) }, ...(target?.kind === 'DIAGNOSTIC' ? { auditId: target.parentAuditId } : { status: { in: ['OPEN', 'REGRESSED'] } }),
        checkId: { startsWith: 'slow-3g-cta-delayed' }, verificationRule: SLOW_REPLAY_VERIFICATION_RULE,
      }, take: 100, orderBy: { createdAt: 'desc' }, select: { evidenceTargets: true } }) : []
      const expectedActions = [...new Map(prior.flatMap(flag => readSlowActionTargets(flag.evidenceTargets)).filter(action => {
        const identity = slowActionContextSchema.parse(JSON.parse(action.context))
        return identity.sourcePageKey ? identity.sourcePageKey === capturePageKey(context.input.pageUrl)
          : normalizeVerifierUrl(identity.pageUrl) === normalizeVerifierUrl(context.input.pageUrl)
      }).map(action => [JSON.stringify([action.label, action.context]), action])).values()].slice(0, 20)
      const result = await runSlowReplay(await getAuditBrowser(), context.audit.id, context.input.pageUrl,
        { deadline: context.deadline, expectedActions, pageKey: 'p' + context.input.position + '-g' + context.task.workGeneration, scanAccess: await resolveAuditScanAccess(context.audit.id) })
      if (!result.navigationComplete || result.reason === 'interrupted') throw new TaskFailure(
        result.reason === 'navigation_unavailable' ? 'SLOW_REPLAY_PAGE_UNAVAILABLE' : 'SLOW_REPLAY_INTERRUPTED', result.reason !== 'navigation_unavailable', undefined, result.reason !== 'navigation_unavailable')
      const assertions = slowReplayAssertions(result), pageUrl = context.input.pageUrl
      const complete = assertions.every(assertion => assertion.complete === true)
      return serializeArtifact('slow-replay', slowSchema.parse({ result, flags: runSlowReplayChecks(result).map(flag => ({ ...flag, pageUrl })),
        receipt: { kind: 'site-module-check', version: 1, module: 'slow-replay', pageUrl, applicable: true, complete,
          passed: complete && assertions.every(assertion => assertion.passed), assertions,
          limitation: 'Bounded top-level mobile viewport text, decoded main image and recognized-action timing on simulated 3G. Unclassified graphics, sampling gaps, missing controls and other devices remain separate or unknown.',
          execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
        } }))
    },
  },
]
