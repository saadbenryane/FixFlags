import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { observationsForFlag } from '@/lib/audit/flag-observations'
import { persistDeterministicFlags } from '@/lib/audit/persist'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'

/** Record custody for newly collected native fixture facts before grouping.
 * This is direct controlled collection, never a claim that a worker ran.
 * Existing historical observations cannot acquire this fixture's provenance. */
export async function persistControlledNativeSource(
  auditId: string,
  flags: Parameters<typeof persistDeterministicFlags>[1],
  scores: Parameters<typeof persistDeterministicFlags>[2],
  declaredMethods?: Record<string, number>,
) {
  const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, select: { url: true, executionSpec: true } })
  const methods = readExecutionSpec(audit.executionSpec)?.checks ?? declaredMethods
  if (!methods) throw new Error('Controlled collection requires explicitly declared method versions')
  for (const flag of flags) {
    const id = flag.checkId.split('::page:')[0]
    if (flag.supportingObservations != null) throw new Error('Controlled collection cannot rewrite existing observation custody')
    if (!methods[id] || CHECK_REGISTRY[id]?.version !== methods[id])
      throw new Error('Controlled collector method does not match the fixture declaration: ' + id)
  }
  return prisma.$transaction(async tx => {
    const collection = await tx.auditVerifierExecution.create({ data: {
      auditId, targetKey: 'fixture:controlled-native:' + randomUUID(), scopeKey: 'controlled-source',
      source: 'DETERMINISTIC', status: 'COMPLETED',
      detail: JSON.parse(JSON.stringify({ kind: 'controlled-native-source', version: 1, methods, collectedAt: null, flags })) as Prisma.InputJsonValue,
    } })
    const recorded = flags.map(flag => {
      const scoped = { ...flag, pageUrl: flag.pageUrl ?? audit.url }
      return { ...scoped, supportingObservations: observationsForFlag(scoped, { auditId, taskId: collection.id,
        checkVersion: methods[flag.checkId.split('::page:')[0]], collectedAt: null }) }
    })
    await persistDeterministicFlags(auditId, recorded, scores, tx)
  })
}
