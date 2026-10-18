import { Prisma } from '@prisma/client'
import { executionTransaction } from '@/lib/audit/execution-ownership'
import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import { newestRecordedFlag } from '@/lib/sites/flag-resolution'
import { comparableOutcomeCoverage } from '../domain/outcome-proof'
import { outcomeIncidentTransition, readOutcomeIncident } from '../domain/outcome-incident'
import { readExecutionSpec } from '../domain/execution-spec'

type AssessmentInput = Prisma.OutcomeAssessmentUncheckedCreateInput & {
  projectId: string; bindingKeys: string[]; failureFlagIds: string[]; outcomeKind: string
}

/** One fenced projection owns assessment, incident continuity and recovered Flags.
 * Append-only assessments retain their decision even if finalization is retried. */
export async function persistOutcomeAssessment(input: AssessmentInput) {
  const { projectId, bindingKeys, failureFlagIds, outcomeKind, ...assessment } = input
  return executionTransaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fixflags:outcome-incident:${input.outcomeId}`}, 0))`
    const request = await tx.runRequest.findFirst({ where: { id: input.runRequestId, projectId }, select: { requestedAt: true } })
    if (!request) throw new Error('Outcome assessment has no matching Site request')
    const existing = await tx.outcomeAssessment.findUnique({ where: { runRequestId_outcomeId: {
      runRequestId: input.runRequestId, outcomeId: input.outcomeId } } })
    if (existing) return existing
    const superseding = await tx.outcomeAssessment.findFirst({ where: {
      outcomeId: input.outcomeId, runRequestId: { not: input.runRequestId },
      runRequest: { projectId, requestedAt: { gte: request.requestedAt } },
    }, select: { id: true } })
    const currentFlags = failureFlagIds.length ? await tx.flag.findMany({ where: { id: { in: failureFlagIds }, auditId: input.auditId,
      audit: { projectId }, fingerprint: { in: bindingKeys.map(key => outcomeFlagFingerprint(input.outcomeId, key)) } },
      select: { id: true, status: true } }) : []
    const previous = await tx.outcomeAssessment.findMany({ where: {
      outcomeId: input.outcomeId, auditId: { not: input.auditId }, state: { in: ['CLEAR', 'FLAG'] },
      evidence: { path: ['supersededByAssessmentId'], equals: Prisma.AnyNull },
      assessedAt: { lte: input.assessedAt as Date }, runRequest: { projectId, requestedAt: { lt: request.requestedAt } },
    }, orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }, { id: 'desc' }], take: 50 })
    let before = previous.find(row => comparableOutcomeCoverage(row.coverage, input.coverage)) ?? null
    if (before?.state === 'FLAG' && before.improvementId && !readOutcomeIncident(before.evidence) && bindingKeys.length === 1) {
      const sourceRun = await tx.runRequest.findUnique({ where: { id: before.runRequestId }, select: {
        executionSpec: true, selections: { select: { outcomeId: true } },
      } })
      const sourceFlags = await tx.flag.findMany({ where: { auditId: before.auditId, audit: { projectId },
        improvementOccurrence: { improvementId: before.improvementId }, checkId: { not: null } }, take: 2, select: { id: true, status: true } })
      const version = (input.coverage as { bindings?: Array<{ version?: number }> })?.bindings?.[0]?.version
      const sourceExecution = await tx.outcomeBindingExecution.findFirst({ where: { auditId: before.auditId,
        outcomeId: input.outcomeId, bindingKey: bindingKeys[0], disposition: 'FAILED', bindingVersion: version ?? -1 }, select: { id: true } })
      const sourceSpec = readExecutionSpec(sourceRun?.executionSpec)
      const unambiguous = sourceSpec ? sourceSpec.outcomes.filter(item => item.kind === outcomeKind).length === 1 &&
        sourceSpec.outcomes.some(item => item.id === input.outcomeId && item.kind === outcomeKind)
        : sourceRun?.selections.length === 1 && sourceRun.selections[0].outcomeId === input.outcomeId
      if (unambiguous && sourceFlags.length === 1 &&
        sourceExecution && sourceFlags[0].status !== 'FIXED') {
        const evidence = before.evidence && typeof before.evidence === 'object' && !Array.isArray(before.evidence) ? before.evidence : {}
        before = { ...before, evidence: { ...evidence, incident: { version: 1, transition: 'failure',
          incidentRunRequestId: before.runRequestId, rootFlagIds: [sourceFlags[0].id], flagIds: [sourceFlags[0].id], recoveredFlagIds: [], previousAssessmentId: null } } }
      }
    }
    const incident = outcomeIncidentTransition({ state: input.state, coverage: input.coverage, evidence: input.evidence,
      runRequestId: input.runRequestId, flagIds: currentFlags.map(flag => flag.id), previous: before })
    // A superseded observation remains part of its run's history, but cannot
    // recover or reclassify the current incident or emit a recovery transition.
    if (superseding && ['recovery', 'regression'].includes(incident.transition)) {
      incident.transition = input.state === 'CLEAR' ? 'clear' : 'failure'
      incident.recoveredFlagIds = []
    }
    if (!superseding && incident.transition === 'recovery' && incident.incidentRunRequestId) {
      const fingerprints = bindingKeys.map(key => outcomeFlagFingerprint(input.outcomeId, key))
      const incidentWhere = { outcomeId: input.outcomeId, evidence: { path: ['incident', 'incidentRunRequestId'], equals: incident.incidentRunRequestId } }
      const openFlags = await tx.flag.findMany({ where: { status: { in: ['OPEN', 'REGRESSED'] }, OR: [
        { id: { in: incident.recoveredFlagIds }, audit: { projectId } },
        { audit: { projectId, outcomeAssessments: { some: incidentWhere } }, fingerprint: { in: fingerprints } },
      ] }, select: { id: true, fingerprint: true, createdAt: true } })
      // The receipt names the capture the inbox links to, one per binding.
      // Every open capture of the incident is still resolved below.
      const byIdentity = new Map<string, typeof openFlags>()
      for (const flag of openFlags) {
        const key = flag.fingerprint ?? flag.id
        byIdentity.set(key, [...(byIdentity.get(key) ?? []), flag])
      }
      incident.recoveredFlagIds = [...byIdentity.values()].flatMap(group => {
        const newest = newestRecordedFlag(group)
        return newest ? [newest.id] : []
      }).slice(0, 100)
      await tx.flag.updateMany({ where: { audit: { projectId, outcomeAssessments: { some: incidentWhere } },
        fingerprint: { in: fingerprints }, status: { in: ['OPEN', 'REGRESSED'] } },
        data: { status: 'FIXED', resolvedInId: input.auditId } })
      if (openFlags.length) await tx.flag.updateMany({ where: { id: { in: openFlags.map(flag => flag.id) }, audit: { projectId },
        status: { in: ['OPEN', 'REGRESSED'] } }, data: { status: 'FIXED', resolvedInId: input.auditId } })
      await tx.improvement.updateMany({ where: { projectId, outcomeId: input.outcomeId,
        occurrences: { some: { flag: { audit: { projectId, outcomeAssessments: { some: {
          outcomeId: input.outcomeId, evidence: { path: ['incident', 'incidentRunRequestId'], equals: incident.incidentRunRequestId },
        } } }, fingerprint: { in: bindingKeys.map(key => outcomeFlagFingerprint(input.outcomeId, key)) } } } },
        status: { notIn: ['REJECTED', 'SUPERSEDED'] } }, data: { status: 'VERIFIED' } })
      if (before?.improvementId) await tx.improvement.updateMany({ where: { id: before.improvementId, projectId,
        outcomeId: input.outcomeId, status: { notIn: ['REJECTED', 'SUPERSEDED'] } }, data: { status: 'VERIFIED' } })
    }
    if (!superseding && incident.transition === 'regression') {
      await tx.flag.updateMany({ where: { id: { in: incident.flagIds }, status: 'OPEN' }, data: { status: 'REGRESSED' } })
      await tx.improvementOccurrence.updateMany({ where: { flagId: { in: incident.flagIds } }, data: { kind: 'REGRESSED' } })
    }
    const evidence = input.evidence && typeof input.evidence === 'object' && !Array.isArray(input.evidence) ? input.evidence : {}
    return tx.outcomeAssessment.create({ data: { ...assessment,
      improvementId: input.improvementId ?? (readOutcomeIncident(before?.evidence) ? before?.improvementId : undefined),
      evidence: { ...evidence, ...(superseding ? { supersededByAssessmentId: superseding.id } : {}), incident } as Prisma.InputJsonValue } })
  })
}
