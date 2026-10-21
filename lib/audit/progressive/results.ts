import { z } from 'zod'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import type { Prisma } from '@prisma/client'
import { checkReceiptSchema, scopeCheckEvidence, summarizeCheckAssertions } from '../checks/receipt'
import { CHECK_MODULES } from '../check-registry'
import { recordAssertionVerifiers } from '../checks/verification'
import { searchAttentionSchema } from '../search/contracts'
import { persistDeterministicFlags } from '../persist'
import type { TaskContext } from './registry'
import type { TaskArtifact } from './contracts'
import { observationsForFlag, supportingObservationsSchema } from '../flag-observations'
import { nativeHttpEvidenceSchema } from '../native-http-evidence'

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
  supportingObservations: supportingObservationsSchema.optional(),
}).strict()
export const checkArtifactSchema = z.object({
  flags: z.array(flagSchema).max(500), receipt: checkReceiptSchema, httpEvidence: nativeHttpEvidenceSchema.optional(),
}).strict()

/** A shared collector may inspect more than a category admits. Only admitted
 * findings can be committed or later reconstructed from its task artifact. */
export function scopeTaskArtifact(artifact: TaskArtifact, executionSpec: unknown): TaskArtifact {
  const spec = readExecutionSpec(executionSpec)
  if (!spec || !spec.category && spec.scope !== 'DIAGNOSTIC' || !Array.isArray(artifact.data.flags)) return artifact
  return { ...artifact, data: { ...artifact.data, flags: z.array(flagSchema).parse(artifact.data.flags)
    .filter(flag => Object.hasOwn(spec.checks, flag.checkId.split('::page:')[0])) } }
}

/** Projection and task completion share the task owner's transaction. No result can be
 * visible without its originating committed artifact, or lost after a worker exits. */
export async function commitFindings(context: TaskContext, artifact: TaskArtifact, tx: Prisma.TransactionClient) {
  const incoming = z.array(flagSchema).max(500).parse(artifact.data.flags ?? [])
  // Receipts and comparable repair proofs commit independently. An empty
  // finding result cannot change the report's accumulated actionable union.
  if (!incoming.length) return
  const receipt = artifact.data.receipt as { execution?: { collectedAt?: string } } | undefined
  const spec = readExecutionSpec(context.audit.executionSpec)
  const observed = incoming.map(flag => ({ ...flag, supportingObservations: observationsForFlag(flag,
    context.task?.id ? { auditId: context.audit.id, taskId: context.task.id,
      checkVersion: spec?.checks[flag.checkId.split('::page:')[0]] ?? null, collectedAt: receipt?.execution?.collectedAt ?? artifact.collectedAt } : undefined) }))
  const flags = [...observed, ...await recordedTaskFindings(context.audit.id, tx, context.audit.executionSpec)]
  // Existing overlap policy remains unchanged. Each source receipt retains its findings.
  await persistDeterministicFlags(context.audit.id, flags as import('../flag-types').DeterministicFlag[],
    { MESSAGE: null, EXPERIENCE: null, REACH: null }, tx, { authoritativeProjection: true })
}

/** Deterministic findings survive independently of rendered page compilation.
 * Read only the committed observation projection, never collected HTML or traces. */
export async function recordedTaskFindings(auditId: string, db: Pick<Prisma.TransactionClient, '$queryRaw'>, executionSpec?: unknown) {
  const spec = readExecutionSpec(executionSpec)
  const rows = await db.$queryRaw<Array<{ findings: unknown; taskId?: string; collectedAt?: string }>>`
    SELECT "workResult"->'data'->'flags' AS findings, "id" AS "taskId",
      COALESCE("workResult"->'data'->'receipt'->'execution'->>'collectedAt', "workResult"->>'collectedAt') AS "collectedAt" FROM "audit_verifier_executions"
    WHERE "auditId" = ${auditId} AND "workState" = 'COMPLETED'
      AND "workKind" IN ('check', 'search', 'google', 'flow', 'overlays', 'journeys', 'slow-replay', 'cross-page', 'discovery', 'automatic-accounts')
      AND "workResult"->'data'->'flags' <> '[]'::jsonb
    ORDER BY "createdAt", "id" LIMIT 1200`
  return rows.flatMap(row => row.findings == null ? [] : z.array(flagSchema).max(500).parse(row.findings).map(flag => ({
    ...flag, supportingObservations: observationsForFlag(flag, row.taskId ? { auditId, taskId: row.taskId,
      checkVersion: spec?.checks[flag.checkId.split('::page:')[0]] ?? null, collectedAt: row.collectedAt } : undefined),
  })))
}

/** Module observations and repair proofs share their originating task's commit. */
export async function commitCheckReceipt(context: TaskContext, receipt: z.infer<typeof checkReceiptSchema>, tx: Prisma.TransactionClient, scopeSuffix = '') {
  const spec = readExecutionSpec(context.audit.executionSpec)
  const allowedCheckIds = spec?.category ? Object.keys(spec.checks) : undefined
  if (spec?.category) receipt = { ...receipt, assertions: scopeCheckEvidence({ module: receipt.module,
    flags: [], assertions: receipt.assertions, scope: { area: spec.category.area, allowedCheckIds } }).assertions }
  if (allowedCheckIds && !receipt.assertions.length && CHECK_MODULES[receipt.module]?.area !== spec!.category!.area) return
  receipt = { ...receipt, ...summarizeCheckAssertions(receipt) }
  const scopeKey = 'page:' + receipt.pageUrl + scopeSuffix
  await tx.auditVerifierExecution.upsert({
    where: { auditId_targetKey_scopeKey: { auditId: context.audit.id, targetKey: 'module:' + receipt.module, scopeKey } },
    create: { auditId: context.audit.id, targetKey: 'module:' + receipt.module, scopeKey,
      source: 'DETERMINISTIC', pageUrl: receipt.pageUrl, status: 'COMPLETED', checkVersion: receipt.execution?.checkVersion ?? 1,
      detail: receipt as Prisma.InputJsonValue, evidenceReference: { auditId: context.audit.id, taskId: context.task.id, module: receipt.module, pageUrl: receipt.pageUrl } }, update: {},
  })
  await recordAssertionVerifiers({ auditId: context.audit.id, parentId: context.audit.parentId, primary: context.input.primary, receipt, allowedCheckIds }, tx)
}
