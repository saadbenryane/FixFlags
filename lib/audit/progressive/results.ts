import { z } from 'zod'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import type { Prisma } from '@prisma/client'
import { checkReceiptSchema } from '../checks/receipt'
import { CHECK_ASSERTIONS, CHECK_MODULES } from '../check-registry'
import { recordAssertionVerifiers } from '../checks/verification'
import { searchAttentionSchema } from '../search/contracts'
import { persistDeterministicFlags } from '../persist'
import { collapseFlagsWithAffectedPaths } from '../flag-identity'
import { suppressOverlappingFlags } from '../suppression'
import type { TaskContext } from './registry'
import type { TaskArtifact } from './contracts'

export const flagSchema = z.object({
  checkId: z.string().min(1), rubric: z.enum(['MESSAGE', 'EXPERIENCE', 'REACH']),
  severity: z.enum(['CRITICAL', 'IMPORTANT', 'POLISH']), problem: z.string().min(1),
  evidence: z.string(), fix: z.string(), confidence: z.number().min(0).max(1),
  source: z.literal('DETERMINISTIC'), pageUrl: z.string().url().optional(),
  impactTag: z.string().nullable().optional(), affectedPaths: z.array(z.string()).optional(),
  evidenceTargets: z.array(z.object({
    kind: z.enum(['element', 'page']), source: z.literal('measured'), device: z.enum(['desktop', 'mobile']),
    rect: z.object({ x: z.number().finite(), y: z.number().finite(), width: z.number().finite(), height: z.number().finite() }).strict().optional(),
    selector: z.string().optional(), text: z.string().optional(), label: z.string(),
    context: z.string().min(1).max(4200).optional(),
  }).strict()).optional(), verificationRule: z.string().optional(),
  attentionPolicy: searchAttentionSchema.optional(),
}).strict()
export const checkArtifactSchema = z.object({
  flags: z.array(flagSchema).max(500), receipt: checkReceiptSchema,
}).strict()

/** A shared collector may inspect more than a category admits. Only admitted
 * findings can be committed or later reconstructed from its task artifact. */
export function scopeTaskArtifact(artifact: TaskArtifact, executionSpec: unknown): TaskArtifact {
  const spec = readExecutionSpec(executionSpec)
  if (!spec?.category || !Array.isArray(artifact.data.flags)) return artifact
  return { ...artifact, data: { ...artifact.data, flags: z.array(flagSchema).parse(artifact.data.flags)
    .filter(flag => Object.hasOwn(spec.checks, flag.checkId.split('::page:')[0])) } }
}

/** Projection and task completion share the task owner's transaction. No result can be
 * visible without its originating committed artifact, or lost after a worker exits. */
export async function commitFindings(context: TaskContext, artifact: TaskArtifact, tx: Prisma.TransactionClient) {
  // Do not reload HTML, provider datasets or parsed entities to project attention.
  // Select only the committed findings from the same tenant-scoped physical Audit.
  const rows = await tx.$queryRaw<Array<{ findings: unknown }>>`
    SELECT "workResult"->'data'->'flags' AS findings FROM "audit_verifier_executions"
    WHERE "auditId" = ${context.audit.id} AND "workState" = 'COMPLETED'
      AND "workKind" IN ('check', 'search', 'google', 'flow', 'slow-replay', 'cross-page', 'discovery', 'automatic-accounts')
    ORDER BY "createdAt", "id" LIMIT 1200`
  const flags = [artifact.data.flags, ...rows.map(row => row.findings)].flatMap(value =>
    value == null ? [] : z.array(flagSchema).max(500).parse(value))
  // Existing overlap policy remains unchanged. Each source receipt retains its findings.
  const projected = collapseFlagsWithAffectedPaths(suppressOverlappingFlags(flags as import('../flag-types').DeterministicFlag[]))
  await persistDeterministicFlags(context.audit.id, projected, { MESSAGE: null, EXPERIENCE: null, REACH: null }, tx)
}

/** Module observations and repair proofs share their originating task's commit. */
export async function commitCheckReceipt(context: TaskContext, receipt: z.infer<typeof checkReceiptSchema>, tx: Prisma.TransactionClient, scopeSuffix = '') {
  const spec = readExecutionSpec(context.audit.executionSpec)
  const allowedCheckIds = spec?.category ? Object.keys(spec.checks) : undefined
  if (allowedCheckIds) receipt = { ...receipt, assertions: receipt.assertions.filter(assertion => {
    const definition = CHECK_ASSERTIONS[receipt.module]?.[assertion.key]
    return definition && (definition.area === spec!.category!.area || definition.verifies.some(id => allowedCheckIds.includes(id)))
  }) }
  if (allowedCheckIds && !receipt.assertions.length && CHECK_MODULES[receipt.module]?.area !== spec!.category!.area) return
  const scopeKey = 'page:' + receipt.pageUrl + scopeSuffix
  await tx.auditVerifierExecution.upsert({
    where: { auditId_targetKey_scopeKey: { auditId: context.audit.id, targetKey: 'module:' + receipt.module, scopeKey } },
    create: { auditId: context.audit.id, targetKey: 'module:' + receipt.module, scopeKey,
      source: 'DETERMINISTIC', pageUrl: receipt.pageUrl, status: 'COMPLETED', checkVersion: 1,
      detail: receipt as Prisma.InputJsonValue, evidenceReference: { auditId: context.audit.id, taskId: context.task.id, module: receipt.module, pageUrl: receipt.pageUrl } }, update: {},
  })
  await recordAssertionVerifiers({ auditId: context.audit.id, parentId: context.audit.parentId, primary: context.input.primary, receipt, allowedCheckIds }, tx)
}
