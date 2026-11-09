import { z } from 'zod'
import { LEGACY_TLS_CERTIFICATE_VERIFICATION_RULE, TLS_CERTIFICATE_VERIFICATION_RULE } from '../tls-evidence'
import { LEGACY_RESOURCE_TRANSPORT_CONTEXT, RESOURCE_TRANSPORT_CONTEXT, RESOURCE_TRANSPORT_VERIFICATION_RULE } from '../resource-transport'
import { certificateRequestScope, legacyCertificateRequestContext, readLegacyCertificatePeer } from './certificate-scope'
import { readSupportingObservations, type SupportingObservation } from '../flag-observations'
import { currentKeyboardFocusTarget, KEYBOARD_CONTEXT_PATTERN } from './keyboard'
import { JOURNEY_VERIFICATION_RULE, readJourneyContext } from './journey-evidence'
import { readSlowActionTargets, sameSlowActionIdentity, slowActionContextSchema, SLOW_REPLAY_CONTEXT, SLOW_REPLAY_VERIFICATION_RULE } from '../flow/slow-replay-contract'
import type { Prisma } from '@prisma/client'
import { baseCheckId } from '../flag-identity'
import { verifierScopeKey, verifierTargetKey } from '@/lib/improvements/verifier-scope'
import { checkAssertionSchema, checkReceiptSchema, recordedCheckVersion } from './receipt'
import { currentPageResponseObservation } from './assertion'
import { MODULE_CHECK_DEFINITIONS } from './definitions'
import { DESTINATION_VERIFICATION_RULE, PUBLIC_LINK_VERIFICATION_RULE } from './destination-evidence'
import { FORM_VERIFICATION_RULE } from '../flow/form-evidence'
import { currentFormFeedbackObservation } from './form-validation'
import { SECURITY_HEADER_VERIFICATION_RULE, currentSecurityHeaderObservation, currentSecurityHeaderTarget } from './security-headers'
import { CONSOLE_VERIFICATION_RULE, readConsoleContext } from '../console-evidence'
import { ACCESSIBILITY_VERIFICATION_RULE, AXE_EMBEDDED_SCOPE_CONTEXT, AXE_FRAME_SELECTOR_SEPARATOR, currentAccessibilityObservation, isComparableAccessibilityContext } from './accessibility-rules'
import { PRIMARY_ACTION_VERIFICATION_RULE } from '../flow/primary-action-evidence'
import { PRIMARY_ACTION_RESPONSE_CONTEXT } from '../flow/action-context'
import { POST_CLICK_CHECKS, POST_CLICK_VERIFICATION_RULE, postClickTargetSchema } from './flow-post-click'
import { DESTINATION_TRUST_VERIFICATION_RULE, destinationTrustTargetSchema } from './flow-destination-trust'
import { DESTINATION_CONTENT_CHECKS, DESTINATION_CONTENT_VERIFICATION_RULE, destinationContentTargetSchema } from './flow-destination-content'
import { PRICING_NAVIGATION_RULE, pricingNavigationTargetSchema } from '../flow/pricing-navigation-evidence'
import { MOBILE_NAVIGATION_RULE, readMobileNavigationTarget } from '../flow/mobile-navigation-evidence'
import { SECTION_LINK_VERIFICATION_RULE } from './section-links'
import { LOADING_CHECKS, LOADING_VERIFICATION_RULE } from './loading-evidence'
import { MOTION_VERIFICATION_RULE } from './motion-evidence'
import { INITIAL_OVERLAY_VERIFICATION_RULE, OVERLAY_CHECKS, OVERLAY_CONTEXT_PATTERN, scopedOverlayRule } from './overlay-evidence'
import { hasRenderedPageResponsibility, RENDERED_PAGE_CONTEXT, RENDERED_PAGE_VERIFICATION_RULE } from './rendered-page-evidence'
import { CORRIDOR_CONTEXT } from './corridor-consistency'
import { corridorVerificationSource } from './corridor-contract'
import { isPreviewDeclarationCheck, PUBLIC_PREVIEW_VERIFICATION_RULE } from './preview-contract'
import { TAP_TARGET_CONTEXT, TAP_TARGET_VERIFICATION_RULE } from '../pagespeed-tap-targets'
import { RESOURCE_REPAIR_RULE, resourceCheckPolicy, resourcePageKey } from '../pagespeed-opportunities'
import { PAGESPEED_LAB_RULE, performanceLabKey, performancePageKey, readPerformanceContext } from '../performance-measurement'
import { currentTrackingRequestTarget, isComparableTrackingContext, redactTrackingAssertion, TRACKING_VERIFICATION_RULE } from '../tracking/identity'
import { currentTrackingResponseObservation } from '../tracking/contracts'
import { verificationEvidence } from './verification-evidence'
import { currentEngagementResponseObservation, ENGAGEMENT_CONTEXT, ENGAGEMENT_VERIFICATION_RULE } from '../network-engagement-evidence'
import type { ExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { readPendingFrozenRepairSources } from '@/lib/sites/domain/verification-source'

export const checkVerifierSchema = z.object({
  kind: z.literal('check-verifier'), version: z.literal(1),
  auditId: z.string().min(1), taskId: z.string().min(1), checkId: z.string().min(1),
  checkVersion: z.number().int().positive(), pageUrl: z.string().url(),
  source: z.string().min(1), collectedAt: z.string().datetime(),
  comparable: z.literal(true), verdict: z.enum(['passed', 'failed']), assertion: checkAssertionSchema,
}).strict()

/** Presence assertions cannot verify a different, stricter responsibility. */
export function assertionForTarget(receipt: z.infer<typeof checkReceiptSchema>, checkId: string) {
  return receipt.assertions.find(assertion => assertion.complete !== false && assertion.disposition !== 'observed' &&
    currentPageResponseObservation(assertion) && MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions[assertion.key]?.verifies.includes(checkId))
}

type Assertion = z.infer<typeof checkAssertionSchema>
type Receipt = z.infer<typeof checkReceiptSchema>

/** A passing peer cannot hide a qualified failure of the same original
 * condition. Qualification still owns method, scope and completeness. */
function matchingObservation<T>(candidates: readonly T[], qualifies: (candidate: T) => boolean | undefined, read: (candidate: T) => Assertion): T | undefined {
  let passing: T | undefined
  for (const candidate of candidates) {
    if (!qualifies(candidate)) continue
    if (!read(candidate).passed) return candidate
    passing ??= candidate
  }
  return passing
}

/** Callers first establish comparability and completeness for each original
 * scope. One known failure disproves repair; success needs every original scope. */
function combineScopedAssertions<T>(comparisons: readonly (T | undefined)[], read: (candidate: T) => Assertion) {
  const matched = comparisons.filter((candidate): candidate is T => candidate !== undefined)
  if (!matched.length) return undefined
  const failed = matched.find(candidate => !read(candidate).passed)
  if (!failed && matched.length !== comparisons.length) return undefined
  const representative = read(failed ?? matched[0])
  const observations = [...new Set([representative, ...matched.map(read)])]
  const missing = comparisons.length - matched.length
  const limitation = missing ? ` ${missing} of ${comparisons.length} original comparisons remain unavailable.` : ''
  return { matched, assertion: { ...representative, passed: !failed, complete: true,
    observed: [...new Set(observations.map(item => item.observed))].join(' ').slice(0, 2000 - limitation.length) + limitation } }
}

function supportingTaskReferences(matched: readonly { source: Receipt }[]) {
  return [...new Set(matched.map(candidate => candidate.source))].flatMap(source => source.execution
    ? [{ taskId: source.execution.taskId, pageUrl: source.pageUrl, collectedAt: source.execution.collectedAt }] : [])
}

/** Compare the exact controls and endpoint phases for both repair and Watch recovery. */
export function scopedAssertionForTarget(input: {
  receipt: z.infer<typeof checkReceiptSchema>; checkId: string;
  flag: { evidenceTargets?: unknown; verificationRule?: string | null };
  receipts?: Array<z.infer<typeof checkReceiptSchema>>;
  originalObservations?: readonly SupportingObservation[];
}) {
  const { receipt, checkId, flag } = input
  const checkVersion = recordedCheckVersion(receipt, checkId)
  if (!checkVersion || !receipt.applicable || receipt.failed) return undefined
  // Module versions describe the receipt format and shared evaluator. Each
  // contributing receipt must also admit this exact check and method.
  const receipts = input.receipts?.filter(source => recordedCheckVersion(source, checkId) === checkVersion)
  if (checkId === 'security-certificate-invalid') {
    const legacy = flag.verificationRule === LEGACY_TLS_CERTIFICATE_VERIFICATION_RULE
    if (receipt.module !== 'security' || receipt.execution?.source !== 'http' ||
      !legacy && flag.verificationRule !== TLS_CERTIFICATE_VERIFICATION_RULE) return undefined
    const targets = z.array(z.object({ context: z.string() }).passthrough()).min(1).safeParse(flag.evidenceTargets)
    const aggregate = assertionForTarget(receipt, checkId)
    if (!targets.success || aggregate?.complete !== true) return undefined
    const { pageUrl } = receipt
    const legacyScope = legacyCertificateRequestContext(pageUrl)
    const scope = certificateRequestScope(pageUrl)
    let original: (string | null)[] = targets.data.map(target => target.context).filter(context => context.startsWith(scope))
    if (legacy) {
      if (!targets.data.some(target => target.context === legacyScope)) return undefined
      original = (input.originalObservations ?? []).filter(item => item.pageUrl &&
        legacyCertificateRequestContext(item.pageUrl) === legacyScope && baseCheckId(item.checkId) === checkId)
        .map(item => item.source === 'DETERMINISTIC' && item.checkVersion === checkVersion && item.provenance?.collectedAt &&
          item.verificationRule === LEGACY_TLS_CERTIFICATE_VERIFICATION_RULE &&
          item.evidenceTargets.some(target => target.context === legacyScope)
          ? readLegacyCertificatePeer(pageUrl, item.evidence, false) : null)
    }
    const historicalPeer = legacy && aggregate.context === legacyScope && !aggregate.measurements
      ? readLegacyCertificatePeer(pageUrl, aggregate.observed, aggregate.passed) : null
    const measurements = aggregate.measurements ?? (historicalPeer
      ? [{ context: historicalPeer, passed: aggregate.passed, observed: aggregate.observed }] : [])
    const comparisons = original.map(context => {
      const measurement = measurements.find(item => item.context === context)
      return measurement ? { ...aggregate, ...measurement, measurements: [measurement] } : undefined
    })
    const combined = combineScopedAssertions(comparisons, item => item)
    return combined ? { assertion: combined.assertion, supportingTasks: [] } : undefined
  }
  if (receipt.module === 'network') {
    if (receipt.execution?.source !== 'browser-network' || flag.verificationRule !== ENGAGEMENT_VERIFICATION_RULE) return undefined
    const targets = z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('desktop'),
      context: z.string().regex(ENGAGEMENT_CONTEXT) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
    if (!targets.success) return undefined
    const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'network' && source.applicable && !source.failed &&
      source.execution?.auditId === receipt.execution!.auditId && source.execution.source === 'browser-network' &&
      source.execution.checkVersion === receipt.execution!.checkVersion)
    const candidates = sources.flatMap(source => source.assertions.filter(item => item.complete === true && item.disposition !== 'observed' &&
      currentEngagementResponseObservation(item) &&
      MODULE_CHECK_DEFINITIONS.network.assertions[item.key]?.verifies.includes(checkId)).map(item => ({ item, source })))
    const matched = targets.data.map(target => matchingObservation(candidates, candidate => candidate.item.context === target.context, candidate => candidate.item))
    const combined = combineScopedAssertions(matched, candidate => candidate.item)
    return combined ? { assertion: combined.assertion, supportingTasks: supportingTaskReferences(combined.matched) } : undefined
  }
  const lab = performanceLabKey(checkId)
  if (lab) {
    const device = checkId.startsWith('mobile-') ? 'mobile' : 'desktop'
    if (receipt.module !== (device === 'mobile' ? 'mobile' : 'performance') ||
      receipt.execution?.source !== 'pagespeed-' + device || flag.verificationRule !== PAGESPEED_LAB_RULE) return undefined
    const targets = z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal(device), context: z.string() }).passthrough())
      .min(1).max(200).safeParse(flag.evidenceTargets)
    if (!targets.success || targets.data.some(target => readPerformanceContext(target.context)?.context !== 'lab:' + lab)) return undefined
    const original = targets.data.filter(target => readPerformanceContext(target.context)?.pageKey === performancePageKey(receipt.pageUrl))
    if (!original.length) return undefined
    const matched = original.map(target => receipt.assertions.find(assertion => assertion.key === lab && assertion.context === target.context &&
      assertion.complete === true && assertion.disposition !== 'observed'))
    const combined = combineScopedAssertions(matched, assertion => assertion)
    return combined ? { assertion: combined.assertion, supportingTasks: [] } : undefined
  }
  const resource = resourceCheckPolicy(checkId)
  if (resource) {
    const device = checkId.startsWith('mobile-') ? 'mobile' : 'desktop'
    if (receipt.module !== (device === 'mobile' ? 'mobile' : 'performance') ||
      receipt.execution?.source !== 'pagespeed-' + device || flag.verificationRule !== RESOURCE_REPAIR_RULE) return undefined
    const targets = z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal(device),
      context: z.string(),
    }).passthrough()).min(1).max(200).safeParse(flag.evidenceTargets)
    if (!targets.success || targets.data.some(target => {
      const context = readPerformanceContext(target.context)?.context
      return !context || !/^pagespeed-resource:v1:[a-f0-9]{64}:(desktop|mobile):[a-z0-9-]+:(ms|bytes):\d+$/.test(context) || context.split(':')[3] !== device
    })) return undefined
    const original = targets.data.filter(target => readPerformanceContext(target.context)?.pageKey === performancePageKey(receipt.pageUrl) &&
      readPerformanceContext(target.context)?.context.startsWith('pagespeed-resource:v1:' + resourcePageKey(receipt.pageUrl) + ':' + device + ':'))
    if (!original.length) return undefined
    const aggregate = receipt.assertions.find(item => item.key === resource.key)
    if (!aggregate || aggregate.disposition === 'observed') return undefined
    const comparisons = original.map(target => {
      const measurement = aggregate.measurements?.find(measured => measured.context === target.context)
      return measurement ? { ...aggregate, complete: true, passed: measurement.passed, observed: measurement.observed,
        context: measurement.context, measurements: [measurement],
        targets: aggregate.targets?.filter(measured => measured.context === target.context) } : undefined
    })
    const combined = combineScopedAssertions(comparisons, assertion => assertion)
    if (combined && !combined.assertion.passed) return { assertion: combined.assertion, supportingTasks: [] }
    // Success retains the full provider-family completeness requirement. Older
    // aggregate receipts remain usable only when every original scope is present.
    const assertion = aggregate.complete === true ? aggregate : undefined
    if (!assertion || original.some(target => !assertion.targets?.some(measured => measured.context === target.context))) return undefined
    return { assertion, supportingTasks: [] }
  }
  if (checkId === 'tap-targets-small') {
    if (receipt.module !== 'mobile' || receipt.execution?.source !== 'pagespeed-mobile' || flag.verificationRule !== TAP_TARGET_VERIFICATION_RULE) return undefined
    const targets = z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('mobile'),
      context: z.string() }).passthrough()).min(1).max(200).safeParse(flag.evidenceTargets)
    if (!targets.success || targets.data.some(target => !TAP_TARGET_CONTEXT.test(readPerformanceContext(target.context)?.context ?? ''))) return undefined
    const original = targets.data.filter(target => readPerformanceContext(target.context)?.pageKey === performancePageKey(receipt.pageUrl))
    if (!original.length || original.length > 3) return undefined
    const matched = original.map(target => receipt.assertions.find(assertion => assertion.key === 'tap-targets' &&
      assertion.context === target.context && assertion.complete === true && assertion.disposition !== 'observed'))
    const combined = combineScopedAssertions(matched, assertion => assertion)
    return combined ? { assertion: combined.assertion, supportingTasks: [] } : undefined
  }
  if (receipt.module === 'corridor') {
    const evidenceSource = corridorVerificationSource(flag.verificationRule)
    if (!evidenceSource || receipt.execution?.source !== evidenceSource) return undefined
    const targets = z.array(z.object({ context: z.string().regex(CORRIDOR_CONTEXT) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
    if (!targets.success) return undefined
    const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'corridor' && source.applicable && !source.failed &&
      source.execution?.auditId === receipt.execution!.auditId && source.execution.source === evidenceSource &&
      source.execution.checkVersion === receipt.execution!.checkVersion)
    const candidates = sources.flatMap(source => source.assertions.map(assertion => ({ assertion, source })))
    const matched = targets.data.map(target => matchingObservation(candidates,
      ({ assertion }) => assertion.context === target.context && assertion.complete === true && assertion.disposition !== 'observed' &&
        MODULE_CHECK_DEFINITIONS.corridor.assertions[assertion.key]?.verifies.includes(checkId), candidate => candidate.assertion))
    const combined = combineScopedAssertions(matched, candidate => candidate.assertion)
    return combined ? { assertion: combined.assertion, supportingTasks: supportingTaskReferences(combined.matched) } : undefined
  }
  if (hasRenderedPageResponsibility(receipt.module) && !(receipt.module === 'measurement' && checkId.startsWith('tracking-')) &&
    !((LOADING_CHECKS as readonly string[]).includes(checkId) && flag.verificationRule === LOADING_VERIFICATION_RULE)) {
    if (flag.verificationRule === RENDERED_PAGE_VERIFICATION_RULE) {
      const targets = z.array(z.object({ context: z.string().regex(RENDERED_PAGE_CONTEXT) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
      if (!targets.success || !['rendered-dom', 'browser-network'].includes(receipt.execution?.source ?? '')) return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.applicable && !source.failed && source.module === receipt.module &&
        source.execution?.auditId === receipt.execution!.auditId && source.execution.source === receipt.execution!.source &&
        source.execution.checkVersion === receipt.execution!.checkVersion)
      const candidates = sources.flatMap(source => source.assertions.map(assertion => ({ assertion, source })))
      const matched = targets.data.map(target => matchingObservation(candidates, ({ assertion }) => (checkId === 'mobile-input-zoom'
          ? assertion.targets?.some(control => control.context === target.context && control.selector === target.selector)
          : assertion.context === target.context) && assertion.complete === true && assertion.disposition !== 'observed' &&
          MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions[assertion.key]?.verifies.includes(checkId), candidate => candidate.assertion))
      if (checkId === 'mobile-input-zoom') {
        // This assertion describes a whole control cohort, so retain its full
        // membership proof before using either verdict.
        if (matched.some(candidate => !candidate)) return undefined
        const original = targets.data.filter(target => typeof target.selector === 'string' && target.selector.length > 0)
        if (!original.length) return undefined
        for (const context of new Set(original.map(target => target.context))) {
          const scoped = original.filter(target => target.context === context)
          const observed = [...new Set(matched.map(candidate => candidate!.assertion))]
            .flatMap(assertion => assertion.targets ?? []).filter(target => target.context === context)
          for (const selector of new Set(scoped.map(target => target.selector))) {
            if (observed.filter(target => target.selector === selector).length < scoped.filter(target => target.selector === selector).length) return undefined
          }
        }
      }
      const combined = combineScopedAssertions(matched, candidate => candidate.assertion)
      return combined ? { assertion: combined.assertion, supportingTasks: supportingTaskReferences(combined.matched) } : undefined
    }
    // A historical finding without native conditions cannot borrow a new scoped observation.
    if (receipt.assertions.some(assertion => assertion.context?.startsWith('rendered-page:'))) return undefined
  }
  const tracking = receipt.module === 'measurement' && checkId.startsWith('tracking-')
  const preview = receipt.module === 'og-image' && isPreviewDeclarationCheck(checkId)
  const previewImage = receipt.module === 'og-image' && checkId === 'og-image-broken'
  const destination = receipt.module === 'page-response' || receipt.module === 'auth-checkout' || receipt.module === 'og-image' || receipt.module === 'seo' && checkId === 'broken-internal-links'
  const accessibility = receipt.module === 'accessibility'
  const primaryAction = receipt.module === 'flow'
  const mobileNavigation = receipt.module === 'mobile-navigation'
  const overlays = receipt.module === 'overlays'
  const accounts = receipt.module === 'automatic-accounts'
  const loading = (LOADING_CHECKS as readonly string[]).includes(checkId) && ['interaction', 'mobile-ux-quality'].includes(receipt.module)
  const sections = receipt.module === 'seo' && checkId === 'broken-page-anchors'
  const headers = receipt.module === 'security-headers' && (flag.verificationRule === SECURITY_HEADER_VERIFICATION_RULE || ['security-headers-missing', 'security-headers-hardening'].includes(checkId))
    const form = receipt.module === 'form-validation'
    let assertion = assertionForTarget(receipt, checkId)
    if (checkId === 'security-mixed-content' && flag.verificationRule === RESOURCE_TRANSPORT_VERIFICATION_RULE) {
      const currentScope = Array.isArray(flag.evidenceTargets) && flag.evidenceTargets.some(target => target?.context === RESOURCE_TRANSPORT_CONTEXT)
      const legacyProof = !currentScope && assertion?.context === LEGACY_RESOURCE_TRANSPORT_CONTEXT
      if (receipt.execution?.source !== 'http' || !legacyProof && assertion?.context !== RESOURCE_TRANSPORT_CONTEXT) return undefined
    }
    if (!assertion && !tracking && !destination && !form && !headers && !accessibility && !primaryAction && !sections && !loading && !overlays && !mobileNavigation && receipt.module !== 'journeys' && receipt.module !== 'slow-replay') return undefined
    let supportingTasks: Array<{ taskId: string; pageUrl: string; collectedAt: string }> = []
    if (mobileNavigation) {
      if (flag.verificationRule !== MOBILE_NAVIGATION_RULE || !Array.isArray(flag.evidenceTargets) || !flag.evidenceTargets.length) return undefined
      const targets = flag.evidenceTargets.map(readMobileNavigationTarget)
      if (targets.some(target => !target)) return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'mobile-navigation' && source.applicable && !source.failed &&
        source.execution?.source === 'rendered-dom' && source.execution.auditId === receipt.execution?.auditId && source.execution.checkVersion === receipt.execution?.checkVersion)
      const candidates = sources.flatMap(source => source.assertions.map(item => ({ source, item })))
      const matched = targets.map(target => matchingObservation(candidates,
        ({ item }) => item.key === 'mobile-navigation' && item.context === target!.context && item.complete === true && item.disposition !== 'observed' &&
          target!.members.every(member => item.targets?.some(control => control.context?.startsWith('mobile-nav-link:' + member + ':'))) &&
          (!item.passed || target!.members.every(member => item.targets?.some(control => control.context === 'mobile-nav-link:' + member + ':reachable'))), candidate => candidate.item))
      const combined = combineScopedAssertions(matched, candidate => candidate.item)
      if (!combined) return undefined
      assertion = combined.assertion
      supportingTasks = supportingTaskReferences(combined.matched)
    }
    if (receipt.module === 'journeys') {
      const targets = z.array(z.object({ context: z.string() }).passthrough()).min(1).safeParse(flag.evidenceTargets)
      if (flag.verificationRule !== JOURNEY_VERIFICATION_RULE || !targets.success || targets.data.some(target => !readJourneyContext(target.context))) return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'journeys' && source.applicable && !source.failed &&
        source.execution?.source === 'rendered-dom' && source.execution.auditId === receipt.execution?.auditId && source.execution.checkVersion === receipt.execution?.checkVersion)
      const candidates = sources.flatMap(source => source.assertions.map(item => ({ source, item })))
      const matched = targets.data.map(target => matchingObservation(candidates, ({ item }) =>
        item.context === target.context && item.complete === true && item.disposition !== 'observed' &&
        MODULE_CHECK_DEFINITIONS.journeys.assertions[item.key]?.verifies.includes(checkId), candidate => candidate.item))
      const combined = combineScopedAssertions(matched, candidate => candidate.item)
      if (!combined) return undefined
      assertion = combined.assertion
      supportingTasks = supportingTaskReferences(combined.matched)
    }
    if (overlays) {
      if (receipt.execution?.source !== 'rendered-dom') return undefined
      const kind = (Object.keys(OVERLAY_CHECKS) as Array<keyof typeof OVERLAY_CHECKS>).find(kind => OVERLAY_CHECKS[kind] === checkId)
      const targets = z.array(z.object({ kind: z.literal('element'), source: z.literal('measured'), device: z.enum(['desktop', 'mobile']),
        selector: z.string().min(1), label: z.string().min(1), context: z.string().regex(OVERLAY_CONTEXT_PATTERN) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
      if (!kind || !scopedOverlayRule(flag.verificationRule) || !targets.success || targets.data.some(target => target.context.split(':')[4] !== kind ||
        flag.verificationRule === INITIAL_OVERLAY_VERIFICATION_RULE && target.context.split(':')[3] !== 'page_load')) return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'overlays' && source.execution?.source === 'rendered-dom' && !source.failed && source.applicable &&
        source.execution.auditId === receipt.execution!.auditId && source.execution.checkVersion === receipt.execution!.checkVersion)
      const candidates = sources.flatMap(source => source.assertions.map(item => ({ item, source })))
      const matched = targets.data.map(target => matchingObservation(candidates, ({ item }) => item.key === 'overlay-' + kind &&
        item.context === target.context && item.complete === true && item.disposition !== 'observed' &&
        item.targets?.some(member => member.selector === target.selector && member.label === target.label), candidate => candidate.item))
      const combined = combineScopedAssertions(matched, candidate => candidate.item)
      if (!combined) return undefined
      assertion = combined.assertion
      supportingTasks = supportingTaskReferences(combined.matched)
    }
    if (receipt.module === 'interaction' && checkId === 'motion-ignores-reduced-preference') {
      const targets = z.array(z.object({ kind: z.literal('element'), source: z.literal('measured'), device: z.literal('mobile'),
        selector: z.string().min(1), label: z.string().min(1), context: z.string().regex(/^motion:[a-f0-9]{64}:\d+:(css|transition|script):baseline:\d+$/) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
      if (flag.verificationRule !== MOTION_VERIFICATION_RULE || receipt.execution?.source !== 'rendered-dom' || !targets.success) return undefined
      const groups = new Map<string, typeof targets.data>()
      for (const target of targets.data) groups.set(target.context, [...groups.get(target.context) ?? [], target])
      const compared = [...groups].map(([context, original]) => {
        const split = context.lastIndexOf(':baseline:'), key = context.slice(0, split), baseline = Number(context.slice(split + 10))
        if (!Number.isSafeInteger(baseline) || baseline > 100 || baseline > original.length) return undefined
        const observed = receipt.assertions.find(item => item.key === 'reduced-motion' && item.context === key && item.complete === true && item.disposition !== 'observed')
        if (!observed) return undefined
        const members = z.array(z.object({ selector: z.string().min(1), label: z.string().min(1), context: z.enum(['before', 'after', 'both']) }).strict()).max(200).safeParse(observed.targets)
        if (!members.success) return undefined
        const after = members.data.filter(target => target.context === 'after' || target.context === 'both')
        const matched = original.map(target => members.data.find(candidate => candidate.selector === target.selector && candidate.label === target.label))
        if (after.length && matched.some(target => !target)) return undefined
        if (!observed.passed) return after.length ? observed : undefined
        const surviving = matched.filter(target => target?.context === 'after' || target?.context === 'both').length
        return { ...observed, passed: surviving === 0 || baseline > 0 && surviving < Math.ceil(baseline * 0.5) }
      })
      const combined = combineScopedAssertions(compared, item => item)
      if (!combined) return undefined
      assertion = combined.assertion
    }
    if (loading) {
      const targets = z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.enum(['desktop', 'mobile']),
        context: z.string().regex(/^loading:(desktop|mobile):[a-f0-9]{64}$/) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
      if (receipt.execution?.source !== 'rendered-dom' || flag.verificationRule !== LOADING_VERIFICATION_RULE || !targets.success ||
        targets.data.some(target => !target.context.startsWith('loading:' + target.device + ':'))) return undefined
      const key = checkId === 'loading-indicator-stuck' ? 'blocking-loading-ui' : checkId === 'mobile-load-delay-content' ? 'mobile-loading-delay' : 'loading-delay'
      const matched = targets.data.map(target => receipt.assertions.find(item => item.key === key && item.context === target.context &&
        item.complete === true && item.disposition !== 'observed'))
      const combined = combineScopedAssertions(matched, item => item)
      if (!combined) return undefined
      assertion = combined.assertion
    }
    if (receipt.module === 'slow-replay') {
      if (flag.verificationRule !== SLOW_REPLAY_VERIFICATION_RULE || receipt.execution?.source !== 'rendered-dom') return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'slow-replay' && source.applicable && !source.failed &&
        source.execution?.source === 'rendered-dom' && source.execution.auditId === receipt.execution!.auditId && source.execution.checkVersion === receipt.execution!.checkVersion)
      const candidates = sources.flatMap(source => source.assertions.filter(item => item.complete === true && item.disposition !== 'observed' &&
        item.context && SLOW_REPLAY_CONTEXT.test(item.context)).map(item => ({ item, source })))
      let matched: Array<typeof candidates[number] | undefined>
      if (checkId === 'slow-3g-cta-delayed') {
        const targets = readSlowActionTargets(flag.evidenceTargets)
        if (!targets.length || !Array.isArray(flag.evidenceTargets) || targets.length !== flag.evidenceTargets.length) return undefined
        const scoped = targets.map(target => ({ target, identity: slowActionContextSchema.parse(JSON.parse(target.context)) }))
        if (scoped.some(({ identity }) => !identity.captureKey)) return undefined
        matched = scoped.map(({ target, identity }) => matchingObservation(candidates, ({ item }) => item.key === 'primary-action-visibility' &&
          item.context === 'slow-replay:v2:' + identity.captureKey && item.targets?.some(observed =>
            observed.context && sameSlowActionIdentity({ ...observed, context: observed.context }, target)), candidate => candidate.item))
      } else {
        const targets = z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('mobile'),
          context: z.string().regex(SLOW_REPLAY_CONTEXT) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
        if (!targets.success) return undefined
        matched = targets.data.map(target => matchingObservation(candidates, ({ item }) => item.key === 'meaningful-text' && item.context === target.context, candidate => candidate.item))
      }
      const combined = combineScopedAssertions(matched, candidate => candidate.item)
      if (!combined) return undefined
      const observed = [...new Set(combined.matched.map(candidate => candidate.item))]
      supportingTasks = supportingTaskReferences(combined.matched)
      assertion = { ...combined.assertion, targets: observed.flatMap(item => item.targets ?? []) }
    }
    if (receipt.module === 'console') {
      const contexts = z.array(z.object({ context: z.string().min(1) }).passthrough()).min(2).safeParse(flag.evidenceTargets)
      if (receipt.execution?.source !== 'browser-console' || flag.verificationRule !== CONSOLE_VERIFICATION_RULE || !contexts.success) return undefined
      const expected = contexts.data.map(target => target.context)
      if (!expected.some(context => context.startsWith('console:page_load:desktop:')) || !expected.some(context => context.startsWith('console:page_load:mobile:')) || expected.some(context => context.includes(':unknown'))) return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'console' && source.applicable && !source.failed &&
        source.execution?.source === 'browser-console' && source.execution.auditId === receipt.execution!.auditId && source.execution.checkVersion === receipt.execution!.checkVersion)
      const windows = expected.map(readConsoleContext)
      if (windows.some(window => !window || window.milliseconds < 2000)) return undefined
      const candidates = sources.flatMap(source => source.assertions.filter(item => item.complete === true && item.disposition !== 'observed' &&
        MODULE_CHECK_DEFINITIONS.console.assertions[item.key]?.verifies.includes(checkId)).map(item => ({ item, source, window: readConsoleContext(item.context ?? '') })))
      // One observed error disproves the original all-clear responsibility. A
      // repair needs every original window, through the original failure horizon.
      const failures = candidates.filter(candidate => !candidate.item.passed && windows.some(window => window!.key === candidate.window?.key))
      const matched = failures.length ? failures : windows.map(window => candidates.find(candidate => candidate.item.passed &&
        candidate.window?.key === window!.key && candidate.window.milliseconds >= window!.milliseconds))
      if (matched.some(item => !item)) return undefined
      assertion = { ...matched[0]!.item, passed: !failures.length, complete: true,
        observed: matched.map(candidate => candidate!.item.observed).join(' ').slice(0, 2000) }
      supportingTasks = matched.map(candidate => ({ taskId: candidate!.source.execution!.taskId, pageUrl: candidate!.source.pageUrl, collectedAt: candidate!.source.execution!.collectedAt }))
    }
    if (receipt.module === 'keyboard') {
      const selectors = z.array(z.object({ selector: z.string().min(1), label: z.string().min(1), context: z.string().regex(KEYBOARD_CONTEXT_PATTERN) }).passthrough()).safeParse(flag.evidenceTargets)
      const priorTargets = selectors.success ? selectors.data : []
      if (receipt.execution?.source !== 'keyboard' || !flag.verificationRule?.startsWith('Keyboard probe:') || !priorTargets.length) return undefined
      const candidates = [receipt, ...receipts ?? []].filter(source => source.module === 'keyboard' && source.applicable && !source.failed &&
        source.execution?.source === 'keyboard' && source.execution.auditId === receipt.execution?.auditId &&
        source.execution.checkVersion === receipt.execution?.checkVersion).flatMap(source => source.assertions.filter(item => item.complete !== false && item.disposition !== 'observed' &&
        MODULE_CHECK_DEFINITIONS.keyboard?.assertions[item.key]?.verifies.includes(checkId)).map(item => ({ item, source })))
      const matched = priorTargets.map(prior => {
        const context = currentKeyboardFocusTarget(prior.context)
        return matchingObservation(candidates, ({ item, source }) =>
          (!item.passed || item.complete === true || source.complete === true) && item.targets?.some(target =>
            target.selector === prior.selector && target.label === prior.label && target.context === context), candidate => candidate.item)
      })
      const combined = combineScopedAssertions(matched, candidate => candidate.item)
      if (!combined) return undefined
      supportingTasks = supportingTaskReferences(combined.matched)
      assertion = { ...combined.assertion,
        targets: priorTargets.filter((_, index) => matched[index]).map(({ selector, label, context }) => ({ selector, label, context })) }
    }
    if (tracking || destination || form || headers || accessibility || primaryAction || sections || accounts) {
      const sourceKind = accessibility ? 'browser-accessibility' : tracking ? 'browser-network' : form || primaryAction || sections || accounts ? 'rendered-dom' : 'http'
      if (receipt.execution?.source !== sourceKind) return undefined
      const contexts = z.array(z.object({ context: z.string().min(1) }).passthrough()).safeParse(flag.evidenceTargets)
      const postClick = primaryAction && POST_CLICK_CHECKS.includes(checkId)
      const pricing = primaryAction && checkId === 'flow-pricing-nav-broken'
      const destinationTrust = primaryAction && checkId === 'flow-cta-destination-no-trust'
      const destinationContent = primaryAction && DESTINATION_CONTENT_CHECKS.includes(checkId)
      const scopedRule = preview ? flag.verificationRule === PUBLIC_PREVIEW_VERIFICATION_RULE : receipt.module === 'seo' && checkId === 'broken-internal-links' ? flag.verificationRule === PUBLIC_LINK_VERIFICATION_RULE : accounts ? flag.verificationRule === 'Automatic account observation v1' : sections ? flag.verificationRule === SECTION_LINK_VERIFICATION_RULE : pricing ? flag.verificationRule === PRICING_NAVIGATION_RULE : postClick ? flag.verificationRule === POST_CLICK_VERIFICATION_RULE : destinationTrust ? flag.verificationRule === DESTINATION_TRUST_VERIFICATION_RULE : destinationContent ? flag.verificationRule === DESTINATION_CONTENT_VERIFICATION_RULE : primaryAction ? flag.verificationRule === PRIMARY_ACTION_VERIFICATION_RULE : accessibility ? flag.verificationRule === ACCESSIBILITY_VERIFICATION_RULE : tracking ? flag.verificationRule === TRACKING_VERIFICATION_RULE : form ? flag.verificationRule === FORM_VERIFICATION_RULE : headers ? flag.verificationRule === SECURITY_HEADER_VERIFICATION_RULE : flag.verificationRule === DESTINATION_VERIFICATION_RULE
      if (!scopedRule || !contexts.success || !contexts.data.length) return undefined
      if (tracking && contexts.data.some(target => !isComparableTrackingContext(target.context))) return undefined
      if (sections && contexts.data.some(target => !/^section:(?:v2:)?[a-f0-9]{64}:[a-f0-9]{64}$/.test(target.context))) return undefined
      if (postClick && !z.array(postClickTargetSchema).min(1).safeParse(flag.evidenceTargets).success) return undefined
      if (pricing && !z.array(pricingNavigationTargetSchema).min(1).safeParse(flag.evidenceTargets).success) return undefined
      if (destinationTrust && !z.array(destinationTrustTargetSchema).min(1).safeParse(flag.evidenceTargets).success) return undefined
      if (destinationContent && !z.array(destinationContentTargetSchema).min(1).safeParse(flag.evidenceTargets).success) return undefined
      if (primaryAction && !postClick && !pricing && !destinationTrust && !destinationContent &&
        contexts.data.some(target => !/^flow:(page|control):[a-f0-9]{64}$/.test(target.context) &&
          !(checkId === 'flow-cta-404' && PRIMARY_ACTION_RESPONSE_CONTEXT.test(target.context)))) return undefined
      if (accessibility && contexts.data.some(target => !isComparableAccessibilityContext(target.context))) return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.execution?.auditId === receipt.execution!.auditId &&
        source.module === receipt.module && source.execution.source === sourceKind && source.execution.checkVersion === receipt.execution!.checkVersion && source.applicable && !source.failed)
      const candidates = sources.flatMap(source => source.assertions.filter(item => item.complete === true && item.disposition !== 'observed' &&
        currentPageResponseObservation(item) &&
        (!headers || currentSecurityHeaderObservation(item)) &&
        (!form || currentFormFeedbackObservation(item)) &&
        (!tracking || currentTrackingResponseObservation(item)) &&
        (!accessibility || currentAccessibilityObservation(item, source.assertions)) &&
        MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions[item.key]?.verifies.includes(checkId))
        .map(item => ({ item: tracking ? redactTrackingAssertion(item) : item, source })))
      const matched = contexts.data.map(prior => {
        // Historical iframe findings only recorded the outer page context.
        if (accessibility && typeof prior.selector === 'string' && prior.selector.includes(AXE_FRAME_SELECTOR_SEPARATOR) &&
          !prior.context.includes(AXE_EMBEDDED_SCOPE_CONTEXT)) return undefined
        const context = headers ? currentSecurityHeaderTarget(prior.context, checkId)
          : tracking ? currentTrackingRequestTarget(prior.context) : prior.context
        return matchingObservation(candidates, candidate => candidate.item.context === context ||
          previewImage && candidate.item.key === 'preview-image-response' && candidate.item.targets?.some(target => target.context === context) === true,
        candidate => candidate.item)
      })
      const combined = combineScopedAssertions(matched, candidate => candidate.item)
      if (!combined) return undefined
      supportingTasks = supportingTaskReferences(combined.matched)
      assertion = combined.assertion
    }
    if (!assertion) return undefined
    if (receipt.complete === false && assertion.complete !== true) return undefined
    return { assertion, supportingTasks }
}

/** Called inside the task's fenced observation transaction, never from a read. */
export async function recordAssertionVerifiers(input: {
  auditId: string; parentId: string | null; primary: boolean;
  sourceFlagIds?: readonly string[];
  spec?: ExecutionSpec | null;
  projectId?: string | null;
  receipt: z.infer<typeof checkReceiptSchema>;
  allowedCheckIds?: readonly string[];
}, tx: Prisma.TransactionClient): Promise<void> {
  const { receipt } = input
  if (!input.parentId || !receipt.applicable || !receipt.execution || receipt.execution.auditId !== input.auditId || !receipt.assertions.length) return
  const frozen = input.spec?.verificationSources
    ? await readPendingFrozenRepairSources(tx, { id: input.auditId, parentId: input.parentId, projectId: input.projectId }, input.spec) : null
  if (input.spec?.verificationSources && !frozen) return
  const flags: Array<{ checkId: string | null; source: string; fingerprint: string | null; pageUrl: string | null;
    verificationRule: string | null; evidenceTargets: unknown; supportingObservations?: unknown }> = []
  let after = ''
  if (frozen) flags.push(...frozen)
  else for (;;) {
    const selected = await tx.flag.findMany({
      where: {
        ...(input.sourceFlagIds ? { id: { in: [...input.sourceFlagIds], ...(after ? { gt: after } : {}) } }
          : { auditId: input.parentId, ...(after ? { id: { gt: after } } : {}) }),
        improvementOccurrence: { improvement: { attempts: { some: { sourceAuditId: input.parentId, outcome: null } } } },
      },
      take: 500, orderBy: { id: 'asc' },
      select: { id: true, checkId: true, source: true, fingerprint: true, pageUrl: true, verificationRule: true, evidenceTargets: true,
        ...(receipt.module === 'security' ? { supportingObservations: true } : {}) },
    })
    flags.push(...selected)
    if (selected.length < 500) break
    after = selected.at(-1)!.id
  }
  let contextualReceipts: Array<z.infer<typeof checkReceiptSchema>> | undefined
  for (const flag of flags) {
    const checkId = baseCheckId(flag.checkId)
    if (!checkId || flag.source !== 'DETERMINISTIC' && !(flag.source === 'JOURNEY' &&
      (receipt.module === 'overlays' && scopedOverlayRule(flag.verificationRule) || receipt.module === 'journeys' && flag.verificationRule === JOURNEY_VERIFICATION_RULE))) continue
    if (input.allowedCheckIds && !input.allowedCheckIds.includes(checkId)) continue
    if (!Object.values(MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions ?? {}).some(definition => definition.verifies.includes(checkId))) continue
    // Unscoped historical page findings may only use the primary page adapter.
    const tracking = receipt.module === 'measurement' && checkId.startsWith('tracking-')
    const resource = Boolean(resourceCheckPolicy(checkId))
    const contextual = resource || flag.verificationRule === RENDERED_PAGE_VERIFICATION_RULE || receipt.module === 'network' || receipt.module === 'slow-replay' || receipt.module === 'corridor' || receipt.module === 'mobile-navigation' || receipt.module === 'journeys' || receipt.module === 'keyboard' || receipt.module === 'automatic-accounts' || tracking || receipt.module === 'overlays' || receipt.module === 'flow' || receipt.module === 'accessibility' || receipt.module === 'console' || receipt.module === 'auth-checkout' || receipt.module === 'og-image' || receipt.module === 'form-validation' || receipt.module === 'seo' && ['broken-internal-links', 'broken-page-anchors'].includes(checkId)
    if (!contextual && (flag.pageUrl ? verifierScopeKey(flag.pageUrl) !== verifierScopeKey(receipt.pageUrl) : !input.primary)) continue
    if (contextual && !resource && !contextualReceipts) {
      const checks = new Set(flags.flatMap(flag => {
        const id = baseCheckId(flag.checkId)
        return id && (!input.allowedCheckIds || input.allowedCheckIds.includes(id)) ? [id] : []
      }))
      contextualReceipts = await verificationEvidence({ receipt, targets: flags.map(flag => flag.evidenceTargets),
        assertionKeys: Object.entries(MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions ?? {})
          .filter(([, definition]) => definition.verifies.some(id => checks.has(id))).map(([key]) => key) }, tx)
    }
    const originalObservations = flag.verificationRule === LEGACY_TLS_CERTIFICATE_VERIFICATION_RULE
      ? readSupportingObservations(flag.supportingObservations)?.items : undefined
    const scoped = scopedAssertionForTarget({ receipt, checkId, flag, receipts: contextualReceipts, originalObservations })
    if (!scoped) continue
    const { assertion, supportingTasks } = scoped
    const checkVersion = recordedCheckVersion(receipt, checkId)
    if (!checkVersion) continue
    const { checkVersions: admittedVersions, ...execution } = receipt.execution
    void admittedVersions
    const detail = checkVerifierSchema.parse({ kind: 'check-verifier', version: 1,
      ...execution, checkVersion, checkId, pageUrl: resource ? receipt.pageUrl : contextual ? flag.pageUrl ?? receipt.pageUrl : receipt.pageUrl, comparable: true,
      verdict: assertion.passed ? 'passed' : 'failed', assertion })
    const key = { auditId: input.auditId, targetKey: verifierTargetKey(flag)!,
      scopeKey: verifierScopeKey(resource ? receipt.pageUrl : flag.pageUrl) }
    const proof = { taskId: detail.taskId, detail: detail as Prisma.InputJsonValue,
      evidenceReference: { auditId: input.auditId, taskId: detail.taskId, pageUrl: detail.pageUrl,
        assertion: assertion.key, source: detail.source, collectedAt: detail.collectedAt, ...(supportingTasks.length ? { supportingTasks } : {}) } }
    const stored = await tx.auditVerificationReceipt.upsert({
      where: { auditId_targetKey_scopeKey: key },
      create: { ...key, ...proof, checkId, source: flag.source, pageUrl: resource ? receipt.pageUrl : flag.pageUrl,
        status: 'COMPLETED', checkVersion },
      update: {},
      select: { detail: true },
    })
    if (assertion.passed) continue
    const prior = checkVerifierSchema.safeParse(stored?.detail)
    // Module receipts are immutable. The derived summary for this Run can
    // narrow from a pass to a comparable failure as additional tasks settle.
    if (prior.success && prior.data.verdict === 'passed' && prior.data.auditId === input.auditId &&
      prior.data.checkId === checkId && prior.data.checkVersion === checkVersion) {
      await tx.auditVerificationReceipt.updateMany({
        where: { ...key, source: flag.source, status: 'COMPLETED', checkVersion, detail: { path: ['verdict'], equals: 'passed' } },
        data: proof,
      })
    }
  }
}
