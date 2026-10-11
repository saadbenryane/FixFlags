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
  return receipt.assertions.find(assertion => PAGE_CHECK_DEFINITIONS[receipt.module]?.assertions[assertion.key]?.verifies.includes(checkId))
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
      select: { flag: { select: { checkId: true, source: true, fingerprint: true, pageUrl: true } } },
    } } } },
  })
  for (const attempt of attempts) for (const { flag } of attempt.improvement.occurrences) {
    const checkId = baseCheckId(flag.checkId)
    if (!checkId || flag.source !== 'DETERMINISTIC') continue
    // Unscoped historical page findings may only use the primary page adapter.
    if (flag.pageUrl ? verifierScopeKey(flag.pageUrl) !== verifierScopeKey(receipt.pageUrl) : !input.primary) continue
    const assertion = assertionForTarget(receipt, checkId)
    if (!assertion) continue
    const detail = checkVerifierSchema.parse({ kind: 'check-verifier', version: 1,
      ...receipt.execution, checkId, pageUrl: receipt.pageUrl, comparable: true,
      verdict: assertion.passed ? 'passed' : 'failed', assertion })
    const targetKey = verifierTargetKey(flag)!
    const scopeKey = verifierScopeKey(flag.pageUrl)
    await tx.auditVerifierExecution.upsert({
      where: { auditId_targetKey_scopeKey: { auditId: input.auditId, targetKey, scopeKey } },
      create: { auditId: input.auditId, targetKey, scopeKey, checkId, source: flag.source, pageUrl: flag.pageUrl,
        status: 'COMPLETED', checkVersion: detail.checkVersion, detail: detail as Prisma.InputJsonValue,
        evidenceReference: { auditId: input.auditId, taskId: detail.taskId, pageUrl: detail.pageUrl,
          assertion: assertion.key, source: detail.source, collectedAt: detail.collectedAt } },
      update: {},
    })
  }
}
