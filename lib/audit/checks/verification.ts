import { z } from 'zod'
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
import { SECTION_LINK_VERIFICATION_RULE } from './section-links'

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
  const { receipt, checkId, flag } = input
  const tracking = receipt.module === 'measurement' && checkId.startsWith('tracking-')
  const destination = receipt.module === 'auth-checkout' || receipt.module === 'og-image' || receipt.module === 'seo' && checkId === 'broken-internal-links'
  const accessibility = receipt.module === 'accessibility'
  const primaryAction = receipt.module === 'flow'
  const accounts = receipt.module === 'automatic-accounts'
  const sections = receipt.module === 'seo' && checkId === 'broken-page-anchors'
  const headers = receipt.module === 'security-headers' && (flag.verificationRule === SECURITY_HEADER_VERIFICATION_RULE || ['security-headers-missing', 'security-headers-hardening'].includes(checkId))
    const form = receipt.module === 'form-validation'
    let assertion = assertionForTarget(receipt, checkId)
    if (!assertion && !tracking && !destination && !form && !headers && !accessibility && !primaryAction && !sections) return undefined
    let supportingTasks: Array<{ taskId: string; pageUrl: string; collectedAt: string }> = []
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
      const selectors = z.array(z.object({ selector: z.string().min(1), label: z.string().min(1), context: z.string().optional() }).passthrough()).safeParse(flag.evidenceTargets)
      const priorTargets = selectors.success ? selectors.data : []
      if (!flag.verificationRule?.startsWith('Keyboard probe:') || !priorTargets.length) return undefined
      const candidates = receipt.assertions.filter(item => item.complete !== false &&
        MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions[item.key]?.verifies.includes(checkId))
      const matched = priorTargets.map(prior => candidates.find(item => item.targets?.some(target =>
        target.selector === prior.selector && target.label === prior.label && target.context === prior.context)))
      if (matched.some(item => !item || item.passed && item.complete !== true && receipt.complete !== true)) return undefined
      const observed = [...new Set(matched.flatMap(item => item ? [item] : []))]
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
    if (!checkId || flag.source !== 'DETERMINISTIC') continue
    if (input.allowedCheckIds && !input.allowedCheckIds.includes(checkId)) continue
    if (!Object.values(MODULE_CHECK_DEFINITIONS[receipt.module]?.assertions ?? {}).some(definition => definition.verifies.includes(checkId))) continue
    // Unscoped historical page findings may only use the primary page adapter.
    const tracking = receipt.module === 'measurement' && checkId.startsWith('tracking-')
    const contextual = receipt.module === 'automatic-accounts' || tracking || receipt.module === 'flow' || receipt.module === 'accessibility' || receipt.module === 'console' || receipt.module === 'auth-checkout' || receipt.module === 'og-image' || receipt.module === 'form-validation' || receipt.module === 'seo' && ['broken-internal-links', 'broken-page-anchors'].includes(checkId)
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
