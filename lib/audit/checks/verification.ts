import { z } from 'zod'
import { KEYBOARD_CONTEXT_PATTERN } from './keyboard'
import { JOURNEY_VERIFICATION_RULE, readJourneyContext } from './journey-evidence'
import { readSlowActionTargets, sameSlowActionIdentity, SLOW_REPLAY_PROFILE, SLOW_REPLAY_VERIFICATION_RULE } from '../flow/slow-replay-contract'
import type { Prisma } from '@prisma/client'
import { baseCheckId } from '../flag-identity'
import { verifierScopeKey, verifierTargetKey } from '@/lib/improvements/verifier-provenance'
import { checkAssertionSchema, checkReceiptSchema } from './receipt'
import { MODULE_CHECK_DEFINITIONS } from './definitions'
import { DESTINATION_VERIFICATION_RULE } from './destination-evidence'
import { FORM_VERIFICATION_RULE } from '../flow/form-evidence'
import { SECURITY_HEADER_VERIFICATION_RULE } from './security-headers'
import { CONSOLE_VERIFICATION_RULE, readConsoleContext } from '../console-evidence'
import { ACCESSIBILITY_VERIFICATION_RULE } from './accessibility-rules'
import { PRIMARY_ACTION_VERIFICATION_RULE } from '../flow/primary-action-evidence'
import { MOBILE_NAVIGATION_RULE, readMobileNavigationTarget } from '../flow/mobile-navigation-evidence'
import { SECTION_LINK_VERIFICATION_RULE } from './section-links'
import { LOADING_CHECKS, LOADING_VERIFICATION_RULE } from './loading-evidence'
import { MOTION_VERIFICATION_RULE } from './motion-evidence'
import { INITIAL_OVERLAY_VERIFICATION_RULE, OVERLAY_CHECKS, OVERLAY_CONTEXT_PATTERN, scopedOverlayRule } from './overlay-evidence'
import { hasRenderedPageResponsibility, RENDERED_PAGE_CONTEXT, RENDERED_PAGE_VERIFICATION_RULE } from './rendered-page-evidence'
import { CORRIDOR_CONTEXT, CORRIDOR_VERIFICATION_RULE } from './corridor-consistency'
import { TAP_TARGET_CONTEXT, TAP_TARGET_VERIFICATION_RULE } from '../pagespeed-tap-targets'

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

/** Compare the exact controls and endpoint phases for both repair and Watch recovery. */
export function scopedAssertionForTarget(input: {
  receipt: z.infer<typeof checkReceiptSchema>; checkId: string;
  flag: { evidenceTargets?: unknown; verificationRule?: string | null };
  receipts?: Array<z.infer<typeof checkReceiptSchema>>;
}) {
  const { receipt, checkId, flag, receipts } = input
  if (checkId === 'tap-targets-small') {
    if (receipt.module !== 'mobile' || receipt.execution?.source !== 'pagespeed-mobile' || flag.verificationRule !== TAP_TARGET_VERIFICATION_RULE) return undefined
    const targets = z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('mobile'),
      context: z.string().regex(TAP_TARGET_CONTEXT) }).passthrough()).min(1).max(3).safeParse(flag.evidenceTargets)
    if (!targets.success) return undefined
    const matched = targets.data.map(target => receipt.assertions.find(assertion => assertion.key === 'tap-targets' &&
      assertion.context === target.context && assertion.complete === true && assertion.disposition !== 'observed'))
    if (matched.some(assertion => !assertion)) return undefined
    return { assertion: { ...matched[0]!, passed: matched.every(assertion => assertion!.passed), complete: true,
      observed: matched.map(assertion => assertion!.observed).join('; ').slice(0, 2000) }, supportingTasks: [] }
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
    if (matched.some(candidate => !candidate)) return undefined
    return { assertion: { ...matched[0]!.assertion, complete: true, passed: matched.every(candidate => candidate!.assertion.passed),
      observed: [...new Set(matched.map(candidate => candidate!.assertion.observed))].join(' ').slice(0, 2000) },
      supportingTasks: matched.map(candidate => ({ taskId: candidate!.source.execution!.taskId, pageUrl: candidate!.source.pageUrl,
        collectedAt: candidate!.source.execution!.collectedAt })) }
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
        .find(({ assertion }) => assertion.context === target.context && assertion.complete === true && assertion.disposition !== 'observed' &&
          MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions[assertion.key]?.verifies.includes(checkId)))
      if (matched.some(candidate => !candidate)) return undefined
      return { assertion: { ...matched[0]!.assertion, passed: matched.every(candidate => candidate!.assertion.passed), complete: true,
        observed: [...new Set(matched.map(candidate => candidate!.assertion.observed))].join(' ').slice(0, 2000) },
        supportingTasks: matched.map(candidate => ({ taskId: candidate!.source.execution!.taskId, pageUrl: candidate!.source.pageUrl,
          collectedAt: candidate!.source.execution!.collectedAt })) }
    }
    // A historical finding without native conditions cannot borrow a new scoped observation.
    if (receipt.assertions.some(assertion => assertion.context?.startsWith('rendered-page:'))) return undefined
  }
  const tracking = receipt.module === 'measurement' && checkId.startsWith('tracking-')
  const destination = receipt.module === 'auth-checkout' || receipt.module === 'og-image' || receipt.module === 'seo' && checkId === 'broken-internal-links'
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
    if (!assertion && !tracking && !destination && !form && !headers && !accessibility && !primaryAction && !sections && !loading && !overlays && !mobileNavigation && receipt.module !== 'journeys') return undefined
    let supportingTasks: Array<{ taskId: string; pageUrl: string; collectedAt: string }> = []
    if (mobileNavigation) {
      if (flag.verificationRule !== MOBILE_NAVIGATION_RULE || !Array.isArray(flag.evidenceTargets) || !flag.evidenceTargets.length) return undefined
      const targets = flag.evidenceTargets.map(readMobileNavigationTarget)
      if (targets.some(target => !target)) return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'mobile-navigation' && source.applicable && !source.failed &&
        source.execution?.source === 'rendered-dom' && source.execution.auditId === receipt.execution?.auditId && source.execution.checkVersion === receipt.execution?.checkVersion)
      const matched = targets.map(target => sources.flatMap(source => source.assertions.map(item => ({ source, item })))
        .find(({ item }) => item.key === 'mobile-navigation' && item.context === target!.context && item.complete === true && item.disposition !== 'observed'))
      if (matched.some(candidate => !candidate)) return undefined
      for (const [index, candidate] of matched.entries()) {
        const members = targets[index]!.members
        if (members.some(member => !candidate!.item.targets?.some(item => item.context?.startsWith('mobile-nav-link:' + member + ':')))) return undefined
        if (candidate!.item.passed && members.some(member => !candidate!.item.targets?.some(item => item.context === 'mobile-nav-link:' + member + ':reachable'))) return undefined
      }
      assertion = { ...matched[0]!.item, complete: true, passed: matched.every(candidate => candidate!.item.passed),
        observed: matched.map(candidate => candidate!.item.observed).join(' ').slice(0, 2000) }
      supportingTasks = matched.map(candidate => ({ taskId: candidate!.source.execution!.taskId, pageUrl: candidate!.source.pageUrl,
        collectedAt: candidate!.source.execution!.collectedAt }))
    }
    if (receipt.module === 'journeys') {
      const targets = z.array(z.object({ context: z.string() }).passthrough()).min(1).safeParse(flag.evidenceTargets)
      if (flag.verificationRule !== JOURNEY_VERIFICATION_RULE || !targets.success || targets.data.some(target => !readJourneyContext(target.context))) return undefined
      const sources = [receipt, ...receipts ?? []].filter(source => source.module === 'journeys' && source.applicable && !source.failed &&
        source.execution?.source === 'rendered-dom' && source.execution.auditId === receipt.execution?.auditId && source.execution.checkVersion === receipt.execution?.checkVersion)
      const matched = targets.data.map(target => sources.flatMap(source => source.assertions.map(item => ({ source, item }))).find(({ item }) =>
        item.context === target.context && item.complete === true && item.disposition !== 'observed' &&
        MODULE_CHECK_DEFINITIONS.journeys.assertions[item.key]?.verifies.includes(checkId)))
      if (matched.some(candidate => !candidate)) return undefined
      assertion = { ...matched[0]!.item, passed: matched.every(candidate => candidate!.item.passed), complete: true,
        observed: matched.map(candidate => candidate!.item.observed).join(' ').slice(0, 2000) }
      supportingTasks = matched.map(candidate => ({ taskId: candidate!.source.execution!.taskId, pageUrl: candidate!.source.pageUrl,
        collectedAt: candidate!.source.execution!.collectedAt }))
    }
    if (overlays) {
      const kind = (Object.keys(OVERLAY_CHECKS) as Array<keyof typeof OVERLAY_CHECKS>).find(kind => OVERLAY_CHECKS[kind] === checkId)
      const targets = z.array(z.object({ kind: z.literal('element'), source: z.literal('measured'), device: z.enum(['desktop', 'mobile']),
        selector: z.string().min(1), label: z.string().min(1), context: z.string().regex(OVERLAY_CONTEXT_PATTERN) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
      if (!kind || !scopedOverlayRule(flag.verificationRule) || !targets.success || targets.data.some(target => target.context.split(':')[4] !== kind ||
        flag.verificationRule === INITIAL_OVERLAY_VERIFICATION_RULE && target.context.split(':')[3] !== 'page_load')) return undefined
      const sources = (input.receipts ?? [receipt]).filter(source => source.module === 'overlays' && source.execution?.source === 'rendered-dom' && !source.failed && source.applicable)
      const matched = targets.data.map(target => sources.flatMap(source => source.assertions).find(item => item.key === 'overlay-' + kind &&
        item.context === target.context && item.complete === true && item.disposition !== 'observed' &&
        item.targets?.some(member => member.selector === target.selector && member.label === target.label)))
      if (matched.some(item => !item)) return undefined
      assertion = { ...matched[0]!, passed: matched.every(item => item!.passed), complete: true,
        observed: [...new Set(matched.map(item => item!.observed))].join(' ').slice(0, 2000) }
      supportingTasks = sources.flatMap(source => source.execution ? [{ taskId: source.execution.taskId, pageUrl: source.pageUrl, collectedAt: source.execution.collectedAt }] : [])
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
      if (compared.some(item => !item)) return undefined
      assertion = { ...compared[0]!, passed: compared.every(item => item!.passed), complete: true,
        observed: compared.map(item => item!.observed).join(' ').slice(0, 2000) }
    }
    if (loading) {
      const targets = z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.enum(['desktop', 'mobile']),
        context: z.string().regex(/^loading:(desktop|mobile):[a-f0-9]{64}$/) }).passthrough()).min(1).safeParse(flag.evidenceTargets)
      if (receipt.execution?.source !== 'rendered-dom' || flag.verificationRule !== LOADING_VERIFICATION_RULE || !targets.success ||
        targets.data.some(target => !target.context.startsWith('loading:' + target.device + ':'))) return undefined
      const key = checkId === 'loading-indicator-stuck' ? 'blocking-loading-ui' : checkId === 'mobile-load-delay-content' ? 'mobile-loading-delay' : 'loading-delay'
      const matched = targets.data.map(target => receipt.assertions.find(item => item.key === key && item.context === target.context &&
        item.complete === true && item.disposition !== 'observed'))
      if (matched.some(item => !item)) return undefined
      assertion = { ...matched[0]!, passed: matched.every(item => item!.passed), complete: true,
        observed: [...new Set(matched.map(item => item!.observed))].join(' ').slice(0, 2000) }
    }
    if (receipt.module === 'slow-replay') {
      if (flag.verificationRule !== SLOW_REPLAY_VERIFICATION_RULE ||
        receipt.execution?.source !== 'rendered-dom' || assertion?.context !== SLOW_REPLAY_PROFILE) return undefined
      if (checkId === 'slow-3g-cta-delayed') {
        const targets = readSlowActionTargets(flag.evidenceTargets)
        if (!targets.length) return undefined
        const matched = targets.map(target => receipt.assertions.find(item => item.key === 'primary-action-visibility' && item.complete === true &&
          item.disposition !== 'observed' && item.context === SLOW_REPLAY_PROFILE && item.targets?.some(observed =>
            observed.context && sameSlowActionIdentity({ ...observed, context: observed.context }, target))))
        if (matched.some(item => !item)) return undefined
        assertion = { ...matched[0]!, passed: matched.every(item => item!.passed), complete: true, targets: matched.flatMap(item => item!.targets ?? []),
          observed: [...new Set(matched.map(item => item!.observed))].join(' ').slice(0, 2000) }
      } else if (!z.array(z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('mobile'),
        context: z.literal(SLOW_REPLAY_PROFILE) }).passthrough()).min(1).safeParse(flag.evidenceTargets).success) return undefined
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
      const candidates = [receipt, ...receipts ?? []].filter(source => source.module === 'keyboard' && source.applicable &&
        source.execution?.source === 'keyboard' && source.execution.auditId === receipt.execution?.auditId &&
        source.execution.checkVersion === receipt.execution?.checkVersion).flatMap(source => source.assertions.filter(item => item.complete !== false && item.disposition !== 'observed' &&
        MODULE_CHECK_DEFINITIONS.keyboard?.assertions[item.key]?.verifies.includes(checkId)).map(item => ({ item, source })))
      const matched = priorTargets.map(prior => candidates.find(({ item }) => item.targets?.some(target =>
        target.selector === prior.selector && target.label === prior.label && target.context === prior.context)))
      if (matched.some(candidate => !candidate || candidate.item.passed && candidate.item.complete !== true && candidate.source.complete !== true)) return undefined
      const observed = [...new Set(matched.flatMap(candidate => candidate ? [candidate.item] : []))]
      supportingTasks = matched.flatMap(candidate => candidate?.source.execution ? [{ taskId: candidate.source.execution.taskId,
        pageUrl: candidate.source.pageUrl, collectedAt: candidate.source.execution.collectedAt }] : [])
      assertion = { ...observed[0], passed: observed.every(item => item.passed), complete: true,
        targets: priorTargets.map(({ selector, label, context }) => ({ selector, label, ...(context ? { context } : {}) })),
        observed: observed.map(item => item.observed).join(' ').slice(0, 2000) }
    }
    if (tracking || destination || form || headers || accessibility || primaryAction || sections || accounts) {
      const sourceKind = accessibility ? 'browser-accessibility' : tracking ? 'browser-network' : form || primaryAction || sections || accounts ? 'rendered-dom' : 'http'
      if (receipt.execution?.source !== sourceKind) return undefined
      const contexts = z.array(z.object({ context: z.string().min(1) }).passthrough()).safeParse(flag.evidenceTargets)
      const scopedRule = accounts ? flag.verificationRule === 'Automatic account observation v1' : sections ? flag.verificationRule === SECTION_LINK_VERIFICATION_RULE : primaryAction ? flag.verificationRule === PRIMARY_ACTION_VERIFICATION_RULE : accessibility ? flag.verificationRule === ACCESSIBILITY_VERIFICATION_RULE : tracking ? flag.verificationRule?.startsWith('Tracking observation:') : form ? flag.verificationRule === FORM_VERIFICATION_RULE : headers ? flag.verificationRule === SECURITY_HEADER_VERIFICATION_RULE : flag.verificationRule === DESTINATION_VERIFICATION_RULE
      if (!scopedRule || !contexts.success || !contexts.data.length) return undefined
      if (sections && contexts.data.some(target => !/^section:[a-f0-9]{64}:[a-f0-9]{64}$/.test(target.context))) return undefined
      if (primaryAction && contexts.data.some(target => !/^flow:(page|control):[a-f0-9]{64}$/.test(target.context))) return undefined
      if (accessibility && contexts.data.some(target => target.context.includes(':unknown:') || !target.context.startsWith('accessibility:'))) return undefined
      const sources = [receipt, ...input.receipts ?? []].filter(source => source.execution?.auditId === receipt.execution!.auditId &&
        source.module === receipt.module && source.execution.source === sourceKind && source.execution.checkVersion === receipt.execution!.checkVersion && source.applicable && !source.failed)
      const candidates = sources.flatMap(source => source.assertions.filter(item => item.complete === true && item.disposition !== 'observed' &&
        MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions[item.key]?.verifies.includes(checkId)).map(item => ({ item, source })))
      const matched = contexts.data.map(prior => candidates.find(candidate => candidate.item.context === prior.context))
      if (matched.some(item => !item)) return undefined
      const observed = [...new Set(matched.flatMap(candidate => candidate ? [candidate.item] : []))]
      supportingTasks = matched.flatMap(candidate => candidate?.source.execution ? [{ taskId: candidate.source.execution.taskId, pageUrl: candidate.source.pageUrl, collectedAt: candidate.source.execution.collectedAt }] : [])
      assertion = { ...observed[0], passed: observed.every(item => item.passed), complete: true,
        observed: observed.map(item => item.observed).join(' ').slice(0, 2000) }
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
    const contextual = flag.verificationRule === RENDERED_PAGE_VERIFICATION_RULE || receipt.module === 'corridor' || receipt.module === 'mobile-navigation' || receipt.module === 'journeys' || receipt.module === 'keyboard' || receipt.module === 'automatic-accounts' || tracking || receipt.module === 'overlays' || receipt.module === 'flow' || receipt.module === 'accessibility' || receipt.module === 'console' || receipt.module === 'auth-checkout' || receipt.module === 'og-image' || receipt.module === 'form-validation' || receipt.module === 'seo' && ['broken-internal-links', 'broken-page-anchors'].includes(checkId)
    if (!contextual && (flag.pageUrl ? verifierScopeKey(flag.pageUrl) !== verifierScopeKey(receipt.pageUrl) : !input.primary)) continue
    if (contextual && !contextualReceipts) {
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
    const detail = checkVerifierSchema.parse({ kind: 'check-verifier', version: 1,
      ...receipt.execution, checkId, pageUrl: contextual ? flag.pageUrl ?? receipt.pageUrl : receipt.pageUrl, comparable: true,
      verdict: assertion.passed ? 'passed' : 'failed', assertion })
    const targetKey = verifierTargetKey(flag)!
    const scopeKey = verifierScopeKey(flag.pageUrl)
    await tx.auditVerifierExecution.upsert({
      where: { auditId_targetKey_scopeKey: { auditId: input.auditId, targetKey, scopeKey } },
      create: { auditId: input.auditId, targetKey, scopeKey, checkId, source: flag.source, pageUrl: flag.pageUrl,
        status: 'COMPLETED', checkVersion: detail.checkVersion, detail: detail as Prisma.InputJsonValue,
        evidenceReference: { auditId: input.auditId, taskId: detail.taskId, pageUrl: detail.pageUrl,
          assertion: assertion.key, source: detail.source, collectedAt: detail.collectedAt, ...(supportingTasks.length ? { supportingTasks } : {}) } },
      update: {},
    })
  }
}
