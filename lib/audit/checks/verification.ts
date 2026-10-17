import { z } from 'zod'
import { KEYBOARD_CONTEXT_PATTERN } from './keyboard'
import { JOURNEY_VERIFICATION_RULE, readJourneyContext } from './journey-evidence'
import { readSlowActionTargets, sameSlowActionIdentity, slowActionContextSchema, SLOW_REPLAY_CONTEXT, SLOW_REPLAY_VERIFICATION_RULE } from '../flow/slow-replay-contract'
import type { Prisma } from '@prisma/client'
import { baseCheckId } from '../flag-identity'
import { verifierScopeKey, verifierTargetKey } from '@/lib/improvements/verifier-provenance'
import { checkAssertionSchema, checkReceiptSchema, recordedCheckVersion } from './receipt'
import { MODULE_CHECK_DEFINITIONS } from './definitions'
import { DESTINATION_VERIFICATION_RULE } from './destination-evidence'
import { FORM_VERIFICATION_RULE } from '../flow/form-evidence'
import { SECURITY_HEADER_VERIFICATION_RULE, currentSecurityHeaderObservation } from './security-headers'
import { CONSOLE_VERIFICATION_RULE, readConsoleContext } from '../console-evidence'
import { ACCESSIBILITY_VERIFICATION_RULE } from './accessibility-rules'
import { PRIMARY_ACTION_VERIFICATION_RULE } from '../flow/primary-action-evidence'
import { POST_CLICK_CHECKS, POST_CLICK_VERIFICATION_RULE, postClickTargetSchema } from './flow-post-click'
import { PRICING_NAVIGATION_RULE, pricingNavigationTargetSchema } from '../flow/pricing-navigation-evidence'
import { MOBILE_NAVIGATION_RULE, readMobileNavigationTarget } from '../flow/mobile-navigation-evidence'
import { SECTION_LINK_VERIFICATION_RULE } from './section-links'
import { LOADING_CHECKS, LOADING_VERIFICATION_RULE } from './loading-evidence'
import { MOTION_VERIFICATION_RULE } from './motion-evidence'
import { INITIAL_OVERLAY_VERIFICATION_RULE, OVERLAY_CHECKS, OVERLAY_CONTEXT_PATTERN, scopedOverlayRule } from './overlay-evidence'
import { hasRenderedPageResponsibility, RENDERED_PAGE_CONTEXT, RENDERED_PAGE_VERIFICATION_RULE } from './rendered-page-evidence'
import { CORRIDOR_CONTEXT, CORRIDOR_VERIFICATION_RULE } from './corridor-consistency'
import { TAP_TARGET_CONTEXT, TAP_TARGET_VERIFICATION_RULE } from '../pagespeed-tap-targets'
import { RESOURCE_REPAIR_RULE, resourceCheckPolicy, resourcePageKey } from '../pagespeed-opportunities'
import { PAGESPEED_LAB_RULE, performanceLabKey, performancePageKey, readPerformanceContext } from '../performance-measurement'
import { TRACKING_VERIFICATION_RULE, TRACKING_REQUEST_CONTEXT } from '../tracking/identity'

export const checkVerifierSchema = z.object({
  kind: z.literal('check-verifier'), version: z.literal(1),
  auditId: z.string().min(1), taskId: z.string().min(1), checkId: z.string().min(1),
  checkVersion: z.number().int().positive(), pageUrl: z.string().url(),
  source: z.string().min(1), collectedAt: z.string().datetime(),
  comparable: z.literal(true), verdict: z.enum(['passed', 'failed']), assertion: checkAssertionSchema,
}).strict()

/** Presence assertions cannot verify a different, stricter responsibility. */
export function assertionForTarget(receipt: z.infer<typeof checkReceiptSchema>, checkId: string) {
  return receipt.assertions.find(assertion => assertion.complete !== false && assertion.disposition !== 'observed' && MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions[assertion.key]?.verifies.includes(checkId))
}

type Assertion = z.infer<typeof checkAssertionSchema>
type Receipt = z.infer<typeof checkReceiptSchema>

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
}) {
  const { receipt, checkId, flag, receipts } = input
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
    if (flag.verificationRule !== CORRIDOR_VERIFICATION_RULE || receipt.execution?.source !== 'rendered-dom') return undefined
    const targets = z.array(z.object({ context: z.string().regex(CORRIDOR_CONTEXT) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
    if (!targets.success) return undefined
    const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'corridor' && source.applicable && !source.failed &&
      source.execution?.auditId === receipt.execution!.auditId && source.execution.source === 'rendered-dom' &&
      source.execution.checkVersion === receipt.execution!.checkVersion)
    const matched = targets.data.map(target => sources.flatMap(source => source.assertions.map(assertion => ({ assertion, source })))
      .find(({ assertion }) => assertion.context === target.context && assertion.complete === true && assertion.disposition !== 'observed' &&
        MODULE_CHECK_DEFINITIONS.corridor.assertions[assertion.key]?.verifies.includes(checkId)))
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
      const matched = targets.data.map(target => sources.flatMap(source => source.assertions.map(assertion => ({ assertion, source })))
        .find(({ assertion }) => (checkId === 'mobile-input-zoom'
          ? assertion.targets?.some(control => control.context === target.context && control.selector === target.selector)
          : assertion.context === target.context) && assertion.complete === true && assertion.disposition !== 'observed' &&
          MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions[assertion.key]?.verifies.includes(checkId)))
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
    if (!assertion && !tracking && !destination && !form && !headers && !accessibility && !primaryAction && !sections && !loading && !overlays && !mobileNavigation && receipt.module !== 'journeys' && receipt.module !== 'slow-replay') return undefined
    let supportingTasks: Array<{ taskId: string; pageUrl: string; collectedAt: string }> = []
    if (mobileNavigation) {
      if (flag.verificationRule !== MOBILE_NAVIGATION_RULE || !Array.isArray(flag.evidenceTargets) || !flag.evidenceTargets.length) return undefined
      const targets = flag.evidenceTargets.map(readMobileNavigationTarget)
      if (targets.some(target => !target)) return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'mobile-navigation' && source.applicable && !source.failed &&
        source.execution?.source === 'rendered-dom' && source.execution.auditId === receipt.execution?.auditId && source.execution.checkVersion === receipt.execution?.checkVersion)
      const matched = targets.map(target => sources.flatMap(source => source.assertions.map(item => ({ source, item })))
        .find(({ item }) => item.key === 'mobile-navigation' && item.context === target!.context && item.complete === true && item.disposition !== 'observed' &&
          target!.members.every(member => item.targets?.some(control => control.context?.startsWith('mobile-nav-link:' + member + ':'))) &&
          (!item.passed || target!.members.every(member => item.targets?.some(control => control.context === 'mobile-nav-link:' + member + ':reachable')))))
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
      const matched = targets.data.map(target => sources.flatMap(source => source.assertions.map(item => ({ source, item }))).find(({ item }) =>
        item.context === target.context && item.complete === true && item.disposition !== 'observed' &&
        MODULE_CHECK_DEFINITIONS.journeys.assertions[item.key]?.verifies.includes(checkId)))
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
      const matched = targets.data.map(target => sources.flatMap(source => source.assertions.map(item => ({ item, source }))).find(({ item }) => item.key === 'overlay-' + kind &&
        item.context === target.context && item.complete === true && item.disposition !== 'observed' &&
        item.targets?.some(member => member.selector === target.selector && member.label === target.label)))
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
        matched = scoped.map(({ target, identity }) => candidates.find(({ item }) => item.key === 'primary-action-visibility' &&
          item.context === 'slow-replay:v2:' + identity.captureKey && item.targets?.some(observed =>
            observed.context && sameSlowActionIdentity({ ...observed, context: observed.context }, target))))
      } else {
        const targets = z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('mobile'),
          context: z.string().regex(SLOW_REPLAY_CONTEXT) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
        if (!targets.success) return undefined
        matched = targets.data.map(target => candidates.find(({ item }) => item.key === 'meaningful-text' && item.context === target.context))
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
      const sources = [receipt, ...input.receipts ?? []].filter(source => source.module === 'console' && source.applicable && !source.failed &&
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
      const matched = priorTargets.map(prior => candidates.find(({ item, source }) =>
        (!item.passed || item.complete === true || source.complete === true) && item.targets?.some(target =>
          target.selector === prior.selector && target.label === prior.label && target.context === prior.context)))
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
      const scopedRule = accounts ? flag.verificationRule === 'Automatic account observation v1' : sections ? flag.verificationRule === SECTION_LINK_VERIFICATION_RULE : pricing ? flag.verificationRule === PRICING_NAVIGATION_RULE : postClick ? flag.verificationRule === POST_CLICK_VERIFICATION_RULE : primaryAction ? flag.verificationRule === PRIMARY_ACTION_VERIFICATION_RULE : accessibility ? flag.verificationRule === ACCESSIBILITY_VERIFICATION_RULE : tracking ? flag.verificationRule === TRACKING_VERIFICATION_RULE : form ? flag.verificationRule === FORM_VERIFICATION_RULE : headers ? flag.verificationRule === SECURITY_HEADER_VERIFICATION_RULE : flag.verificationRule === DESTINATION_VERIFICATION_RULE
      if (!scopedRule || !contexts.success || !contexts.data.length) return undefined
      if (tracking && contexts.data.some(target => !TRACKING_REQUEST_CONTEXT.test(target.context))) return undefined
      if (sections && contexts.data.some(target => !/^section:(?:v2:)?[a-f0-9]{64}:[a-f0-9]{64}$/.test(target.context))) return undefined
      if (postClick && !z.array(postClickTargetSchema).min(1).safeParse(flag.evidenceTargets).success) return undefined
      if (pricing && !z.array(pricingNavigationTargetSchema).min(1).safeParse(flag.evidenceTargets).success) return undefined
      if (primaryAction && !postClick && !pricing && contexts.data.some(target => !/^flow:(page|control):[a-f0-9]{64}$/.test(target.context))) return undefined
      if (accessibility && contexts.data.some(target => target.context.includes(':unknown:') || !target.context.startsWith('accessibility:'))) return undefined
      const sources = [receipt, ...input.receipts ?? []].filter(source => source.execution?.auditId === receipt.execution!.auditId &&
        source.module === receipt.module && source.execution.source === sourceKind && source.execution.checkVersion === receipt.execution!.checkVersion && source.applicable && !source.failed)
      const candidates = sources.flatMap(source => source.assertions.filter(item => item.complete === true && item.disposition !== 'observed' &&
        (!headers || currentSecurityHeaderObservation(item)) &&
        MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions[item.key]?.verifies.includes(checkId)).map(item => ({ item, source })))
      const matched = contexts.data.map(prior => candidates.find(candidate => candidate.item.context === prior.context))
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
  receipt: z.infer<typeof checkReceiptSchema>;
  allowedCheckIds?: readonly string[];
}, tx: Prisma.TransactionClient): Promise<void> {
  const { receipt } = input
  if (!input.parentId || !receipt.applicable || !receipt.execution || !receipt.assertions.length) return
  const attempts = await tx.improvementAttempt.findMany({
    where: { sourceAuditId: input.parentId, outcome: null }, take: 500, orderBy: { id: 'asc' },
    select: { improvement: { select: { occurrences: {
      where: { auditId: input.parentId }, take: 100, orderBy: { id: 'asc' },
      select: { flag: { select: { checkId: true, source: true, fingerprint: true, pageUrl: true, verificationRule: true, evidenceTargets: true } } },
    } } } },
  })
  let contextualReceipts: Array<z.infer<typeof checkReceiptSchema>> | undefined
  for (const attempt of attempts) for (const { flag } of attempt.improvement.occurrences) {
    const checkId = baseCheckId(flag.checkId)
    if (!checkId || flag.source !== 'DETERMINISTIC' && !(flag.source === 'JOURNEY' &&
      (receipt.module === 'overlays' && scopedOverlayRule(flag.verificationRule) || receipt.module === 'journeys' && flag.verificationRule === JOURNEY_VERIFICATION_RULE))) continue
    if (input.allowedCheckIds && !input.allowedCheckIds.includes(checkId)) continue
    if (!Object.values(MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions ?? {}).some(definition => definition.verifies.includes(checkId))) continue
    // Unscoped historical page findings may only use the primary page adapter.
    const tracking = receipt.module === 'measurement' && checkId.startsWith('tracking-')
    const resource = Boolean(resourceCheckPolicy(checkId))
    const contextual = resource || flag.verificationRule === RENDERED_PAGE_VERIFICATION_RULE || receipt.module === 'slow-replay' || receipt.module === 'corridor' || receipt.module === 'mobile-navigation' || receipt.module === 'journeys' || receipt.module === 'keyboard' || receipt.module === 'automatic-accounts' || tracking || receipt.module === 'overlays' || receipt.module === 'flow' || receipt.module === 'accessibility' || receipt.module === 'console' || receipt.module === 'auth-checkout' || receipt.module === 'og-image' || receipt.module === 'form-validation' || receipt.module === 'seo' && ['broken-internal-links', 'broken-page-anchors'].includes(checkId)
    if (!contextual && (flag.pageUrl ? verifierScopeKey(flag.pageUrl) !== verifierScopeKey(receipt.pageUrl) : !input.primary)) continue
    if (contextual && !resource && !contextualReceipts) {
      const rows = await tx.auditVerifierExecution.findMany({ where: { auditId: input.auditId, targetKey: 'module:' + receipt.module, status: 'COMPLETED' },
        take: 300, select: { detail: true } })
      contextualReceipts = rows.flatMap(row => {
        const parsed = checkReceiptSchema.safeParse(row.detail)
        return parsed.success ? [parsed.data] : []
      })
    }
    const scoped = scopedAssertionForTarget({ receipt, checkId, flag, receipts: contextualReceipts })
    if (!scoped) continue
    const { assertion, supportingTasks } = scoped
    const checkVersion = recordedCheckVersion(receipt, checkId)
    if (!checkVersion) continue
    const { checkVersions: admittedVersions, ...execution } = receipt.execution
    void admittedVersions
    const detail = checkVerifierSchema.parse({ kind: 'check-verifier', version: 1,
      ...execution, checkVersion, checkId, pageUrl: resource ? receipt.pageUrl : contextual ? flag.pageUrl ?? receipt.pageUrl : receipt.pageUrl, comparable: true,
      verdict: assertion.passed ? 'passed' : 'failed', assertion })
    const targetKey = verifierTargetKey(flag)!
    const scopeKey = verifierScopeKey(resource ? receipt.pageUrl : flag.pageUrl)
    await tx.auditVerifierExecution.upsert({
      where: { auditId_targetKey_scopeKey: { auditId: input.auditId, targetKey, scopeKey } },
      create: { auditId: input.auditId, targetKey, scopeKey, checkId, source: flag.source, pageUrl: resource ? receipt.pageUrl : flag.pageUrl,
        status: 'COMPLETED', checkVersion: detail.checkVersion, detail: detail as Prisma.InputJsonValue,
        evidenceReference: { auditId: input.auditId, taskId: detail.taskId, pageUrl: detail.pageUrl,
          assertion: assertion.key, source: detail.source, collectedAt: detail.collectedAt, ...(supportingTasks.length ? { supportingTasks } : {}) } },
      update: {},
    })
  }
}
