import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { checkReceiptSchema } from '../checks/receipt'
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

/** Projection and task completion share the task owner's transaction. No result can be
 * visible without its originating committed artifact, or lost after a worker exits. */
export async function commitFindings(context: TaskContext, artifact: TaskArtifact, tx: Prisma.TransactionClient) {
  // Do not reload HTML, provider datasets or parsed entities to project attention.
  // Select only the committed findings from the same tenant-scoped physical Audit.
  const rows = await tx.$queryRaw<Array<{ findings: unknown }>>`
    SELECT "workResult"->'data'->'flags' AS findings FROM "audit_verifier_executions"
    WHERE "auditId" = ${context.audit.id} AND "workState" = 'COMPLETED'
      AND "workKind" IN ('check', 'search', 'google', 'flow', 'slow-replay', 'cross-page', 'discovery')
    ORDER BY "createdAt", "id" LIMIT 1200`
  const flags = [artifact.data.flags, ...rows.map(row => row.findings)].flatMap(value =>
    value == null ? [] : z.array(flagSchema).max(500).parse(value))
  // Existing overlap policy remains unchanged. Each source receipt retains its findings.
  const projected = collapseFlagsWithAffectedPaths(suppressOverlappingFlags(flags as import('../flag-types').DeterministicFlag[]))
  await persistDeterministicFlags(context.audit.id, projected, { MESSAGE: null, EXPERIENCE: null, REACH: null }, tx)
}
