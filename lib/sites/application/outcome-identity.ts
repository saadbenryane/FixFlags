import type { Prisma } from '@prisma/client'
import { outcomeFlagOwner } from '@/lib/audit/flag-identity'
import { readExecutionSpec } from '../domain/execution-spec'
import { admittedOutcomeCoverage, comparableOutcomeCoverage } from '../domain/outcome-proof'

/** Retain a historical Improvement ID only when its recorded single binding
 * establishes unambiguous ownership. Shared or unscoped history cannot be guessed. */
export async function adoptLegacyOutcomeIdentity(tx: Prisma.TransactionClient, input: {
  projectId: string; fingerprint: string; executionSpec: unknown;
}) {
  const owner = outcomeFlagOwner(input.fingerprint), spec = readExecutionSpec(input.executionSpec)
  const outcome = owner && spec?.outcomes.find(item => item.id === owner.outcomeId)
  if (!owner || !spec || !outcome || outcome.bindings.filter(binding => binding.required).length !== 1) return
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fixflags:outcome-incident:${owner.outcomeId}`}, 0))`
  if (await tx.improvement.findUnique({ where: { projectId_fingerprint: { projectId: input.projectId, fingerprint: input.fingerprint } }, select: { id: true } })) return
  const candidates = await tx.improvement.findMany({ where: { projectId: input.projectId, outcomeId: owner.outcomeId,
    NOT: { fingerprint: { startsWith: 'outcome:v1:' } }, outcomeAssessments: { none: { outcomeId: { not: owner.outcomeId } } },
    occurrences: { none: { audit: { outcomeAssessments: { none: { outcomeId: owner.outcomeId } } } } },
  }, take: 2, select: { id: true, outcomeAssessments: { where: { outcomeId: owner.outcomeId, state: 'FLAG' }, take: 1,
    orderBy: { assessedAt: 'desc' }, select: { coverage: true, runRequest: { select: { executionSpec: true, selections: { select: { outcomeId: true } } } },
      audit: { select: { bindingExecutions: { where: { outcomeId: owner.outcomeId, bindingKey: owner.bindingKey, disposition: 'FAILED' }, select: { bindingVersion: true } } } } } } } })
  if (candidates.length !== 1) return
  const source = candidates[0].outcomeAssessments[0], binding = outcome.bindings.find(item => item.required)!
  const sourceSpec = source && readExecutionSpec(source.runRequest.executionSpec)
  const unambiguous = sourceSpec ? sourceSpec.outcomes.filter(item => item.kind === outcome.kind).length === 1 &&
    sourceSpec.outcomes.some(item => item.id === owner.outcomeId && item.kind === outcome.kind) : source?.runRequest.selections.length === 1
  if (!source || !unambiguous || !comparableOutcomeCoverage(source.coverage, admittedOutcomeCoverage(spec, outcome)) ||
    !source.audit.bindingExecutions.some(execution => execution.bindingVersion === binding.version)) return
  await tx.improvement.update({ where: { id: candidates[0].id }, data: { fingerprint: input.fingerprint } })
}
