import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { baseCheckId } from '../flag-identity'
import { verifierScopeKey, verifierTargetKey } from '@/lib/improvements/verifier-provenance'
import { checkAssertionSchema, checkReceiptSchema } from './receipt'
import { PAGE_CHECK_DEFINITIONS } from './definitions'

export const checkVerifierSchema = z.object({
  kind: z.literal('check-verifier'), version: z.literal(1),
  auditId: z.string().min(1), taskId: z.string().min(1), checkId: z.string().min(1),
  checkVersion: z.number().int().positive(), pageUrl: z.string().url(),
  source: z.string().min(1), collectedAt: z.string().datetime(),
  comparable: z.literal(true), verdict: z.enum(['passed', 'failed']), assertion: checkAssertionSchema,
}).strict()

/** Presence assertions cannot verify a different, stricter responsibility. */
export function assertionForTarget(receipt: z.infer<typeof checkReceiptSchema>, checkId: string) {
  return receipt.assertions.find(assertion => assertion.complete !== false && assertion.disposition !== 'observed' && PAGE_CHECK_DEFINITIONS[receipt.module]?.assertions[assertion.key]?.verifies.includes(checkId))
}

/** Compare the exact controls and endpoint phases for both repair and Watch recovery. */
export function scopedAssertionForTarget(input: {
  receipt: z.infer<typeof checkReceiptSchema>; checkId: string;
  flag: { evidenceTargets?: unknown; verificationRule?: string | null };
  receipts?: Array<z.infer<typeof checkReceiptSchema>>;
}) {
  const { receipt, checkId, flag } = input
  const tracking = receipt.module === 'measurement' && checkId.startsWith('tracking-')
    let assertion = assertionForTarget(receipt, checkId)
    if (!assertion && !tracking) return undefined
    let supportingTasks: Array<{ taskId: string; pageUrl: string; collectedAt: string }> = []
    if (receipt.module === 'keyboard') {
      const selectors = z.array(z.object({ selector: z.string().min(1), label: z.string().min(1), context: z.string().optional() }).passthrough()).safeParse(flag.evidenceTargets)
      const priorTargets = selectors.success ? selectors.data : []
      if (!flag.verificationRule?.startsWith('Keyboard probe:') || !priorTargets.length) return undefined
      const candidates = receipt.assertions.filter(item => item.complete !== false &&
        PAGE_CHECK_DEFINITIONS[receipt.module]?.assertions[item.key]?.verifies.includes(checkId))
      const matched = priorTargets.map(prior => candidates.find(item => item.targets?.some(target =>
        target.selector === prior.selector && target.label === prior.label && target.context === prior.context)))
      if (matched.some(item => !item || item.passed && item.complete !== true && receipt.complete !== true)) return undefined
      const observed = [...new Set(matched.flatMap(item => item ? [item] : []))]
      assertion = { ...observed[0], passed: observed.every(item => item.passed), complete: true,
        targets: priorTargets.map(({ selector, label, context }) => ({ selector, label, ...(context ? { context } : {}) })),
        observed: observed.map(item => item.observed).join(' ').slice(0, 2000) }
    }
    if (tracking) {
      if (receipt.execution?.source !== 'browser-network') return undefined
      const contexts = z.array(z.object({ context: z.string().min(1) }).passthrough()).safeParse(flag.evidenceTargets)
      if (!flag.verificationRule?.startsWith('Tracking observation:') || !contexts.success || !contexts.data.length) return undefined
      const sources = [receipt, ...input.receipts ?? []].filter(source => source.execution?.auditId === receipt.execution!.auditId &&
        source.execution.source === 'browser-network' && source.execution.checkVersion === receipt.execution!.checkVersion && source.applicable)
      const candidates = sources.flatMap(source => source.assertions.filter(item => item.complete === true && item.disposition !== 'observed' &&
        PAGE_CHECK_DEFINITIONS[receipt.module]?.assertions[item.key]?.verifies.includes(checkId)).map(item => ({ item, source })))
      const matched = contexts.data.map(prior => candidates.find(candidate => candidate.item.context === prior.context))
      if (matched.some(item => !item)) return undefined
      const observed = [...new Set(matched.flatMap(candidate => candidate ? [candidate.item] : []))]
      supportingTasks = matched.flatMap(candidate => candidate?.source.execution ? [{ taskId: candidate.source.execution.taskId, pageUrl: candidate.source.pageUrl, collectedAt: candidate.source.execution.collectedAt }] : [])
      assertion = { ...observed[0], passed: observed.every(item => item.passed), complete: true,
        observed: observed.map(item => item.observed).join(' ').slice(0, 2000) }
    }
    if (!assertion) return undefined
    return { assertion, supportingTasks }
}

/** Called inside the task's fenced observation transaction, never from a read. */
export async function recordAssertionVerifiers(input: {
  auditId: string; parentId: string | null; primary: boolean;
  receipt: z.infer<typeof checkReceiptSchema>;
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
  for (const attempt of attempts) for (const { flag } of attempt.improvement.occurrences) {
    const checkId = baseCheckId(flag.checkId)
    if (!checkId || flag.source !== 'DETERMINISTIC') continue
    // Unscoped historical page findings may only use the primary page adapter.
    const tracking = receipt.module === 'measurement' && checkId.startsWith('tracking-')
    if (!tracking && (flag.pageUrl ? verifierScopeKey(flag.pageUrl) !== verifierScopeKey(receipt.pageUrl) : !input.primary)) continue
    const rows = tracking ? await tx.auditVerifierExecution.findMany({ where: { auditId: input.auditId, targetKey: 'module:measurement', status: 'COMPLETED' },
      take: 300, select: { detail: true } }) : []
    const receipts = rows.flatMap(row => {
      const parsed = checkReceiptSchema.safeParse(row.detail)
      return parsed.success ? [parsed.data] : []
    })
    const scoped = scopedAssertionForTarget({ receipt, checkId, flag, receipts })
    if (!scoped) continue
    const { assertion, supportingTasks } = scoped
    const detail = checkVerifierSchema.parse({ kind: 'check-verifier', version: 1,
      ...receipt.execution, checkId, pageUrl: tracking ? flag.pageUrl ?? receipt.pageUrl : receipt.pageUrl, comparable: true,
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
