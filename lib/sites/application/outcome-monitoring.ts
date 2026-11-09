import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { readExecutionSpec } from '../domain/execution-spec'
import { readOutcomeIncident, readOutcomeRecovery } from '../domain/outcome-incident'
import type { FlagDiffSummaryItem } from '@/lib/audit/flag-types'
import { hasUnreadableStoredSupportingObservations } from '@/lib/audit/flag-observations'
import { outcomeFlagOwner } from '@/lib/audit/flag-identity'
import { outcomeReceiptJoins, supersededOutcomeReceiptSql } from './outcome-receipt-sql'

/** Notification retries and report comparisons read the committed transition,
 * rather than comparing a scoped run against unrelated report Flags. */
export async function outcomeMonitoringDiff(auditId: string, loaded?: { projectId: string | null; executionSpec: unknown }) {
  const audit = loaded ?? await prisma.audit.findUnique({ where: { id: auditId }, select: {
    projectId: true, executionSpec: true,
  } })
  const spec = readExecutionSpec(audit?.executionSpec)
  if (!audit?.projectId || !spec || !['OUTCOMES', 'SITE'].includes(spec.scope) || !spec.outcomes.length) return null
  const admitted = new Map(spec.outcomes.map(outcome => [outcome.id, {
    bindings: new Set(outcome.bindings.filter(binding => binding.required).map(binding => binding.key)),
    legacyKind: outcome.kind.toLowerCase(),
  }]))
  const receipts = await prisma.$queryRaw<Array<{ outcomeId: string; state: string; evidence: unknown }>>`
    SELECT source."outcomeId", source.state, source.evidence
    FROM outcome_assessments source ${outcomeReceiptJoins}
    JOIN site_outcomes owner ON owner.id = source."outcomeId" AND owner."projectId" = request."projectId"
    WHERE source."auditId" = ${auditId} AND request."projectId" = ${audit.projectId}
      AND source."outcomeId" IN (${Prisma.join([...admitted.keys()])}) AND NOT (${supersededOutcomeReceiptSql})
  `
  type Reference = { id: string; outcomeId: string; recoveredBindingKeys?: string[] }
  const groups = { fixed: [] as Reference[], inconclusive: [] as Reference[], unchanged: [] as Reference[],
    regressed: [] as Reference[], newIssues: [] as Reference[] }
  for (const { outcomeId, state, evidence } of receipts) {
    const incident = readOutcomeIncident(evidence)
    if (!incident) continue
    const references = (ids: string[]) => ids.map(id => ({ id, outcomeId }))
    if (readOutcomeRecovery(evidence, state)) groups.fixed.push(...references(incident.recoveredFlagIds))
    if (incident.inconclusiveFlagIds) groups.inconclusive.push(...references(incident.inconclusiveFlagIds))
    else if (incident.transition === 'unknown') groups.inconclusive.push(...references(incident.rootFlagIds).map(reference => ({
      ...reference, recoveredBindingKeys: incident.recoveredBindingKeys,
    })))
    if (state !== 'FLAG' || !['ongoing_failure', 'regression', 'failure'].includes(incident.transition)) continue
    const regressed = new Set(incident.regressedFlagIds ?? (incident.transition === 'regression' ? incident.flagIds : []))
    const newIssues = new Set(incident.transition === 'ongoing_failure' ? incident.rootFlagIds : incident.flagIds)
    for (const reference of references(incident.flagIds)) {
      const bucket = regressed.has(reference.id) ? 'regressed' : newIssues.has(reference.id) ? 'newIssues' : 'unchanged'
      groups[bucket].push(reference)
    }
  }
  const ids = [...new Set(Object.values(groups).flat().map(reference => reference.id))]
  const flags = ids.length ? await prisma.flag.findMany({ where: { id: { in: ids }, audit: { projectId: audit.projectId } },
    select: { id: true, auditId: true, fingerprint: true, resolvedInId: true, checkId: true, problem: true, rubric: true, severity: true, status: true,
      confidence: true, impactTag: true, attentionPolicy: true, pageUrl: true, supportingObservations: true } }) : []
  const byId = new Map(flags.map(flag => [flag.id, flag]))
  const project = (bucket: keyof typeof groups): FlagDiffSummaryItem[] => {
    const result = new Map<string, FlagDiffSummaryItem>()
    for (const { id, outcomeId, recoveredBindingKeys } of groups[bucket]) {
      const row = byId.get(id)
      if (!row) continue
      const { supportingObservations, fingerprint, resolvedInId, auditId: sourceAuditId, ...flag } = row
      const owner = outcomeFlagOwner(fingerprint)
      if (owner && recoveredBindingKeys?.includes(owner.bindingKey)) continue
      const { bindings, legacyKind } = admitted.get(outcomeId)!
      const belongs = owner ? owner.outcomeId === outcomeId && bindings.has(owner.bindingKey)
        : (bucket === 'fixed' || bucket === 'inconclusive') && [...bindings].some(key => fingerprint === `outcome:${legacyKind}:${key}`)
      if (!belongs || (bucket === 'fixed' ? flag.status !== 'FIXED' || resolvedInId !== auditId
        : bucket !== 'inconclusive' && sourceAuditId !== auditId)) continue
      result.set(id, { ...flag, ...(hasUnreadableStoredSupportingObservations(supportingObservations) ? { supportingEvidenceUnreadable: true } : {}) })
    }
    return [...result.values()]
  }
  return { fixed: project('fixed'), inconclusive: project('inconclusive'), unchanged: project('unchanged'),
    regressed: project('regressed'), newIssues: project('newIssues') }
}

/** The persisted run keeps its finding. Current attention and unsent Watch
 * alerts cannot promote a failure superseded before its assessment committed. */
export async function loadSupersededOutcomeFlagIds(ids: readonly string[], projectIds: readonly string[]): Promise<Set<string>> {
  if (!ids.length || !projectIds.length) return new Set()
  const rows = await prisma.$queryRaw<Array<{ id: string; fingerprint: string; outcomeId: string }>>`
    SELECT f.id, f.fingerprint, source."outcomeId"
    FROM flags f JOIN outcome_assessments source ON source."auditId" = f."auditId"
    ${outcomeReceiptJoins}
    JOIN site_outcomes owner ON owner.id = source."outcomeId" AND owner."projectId" = request."projectId"
    WHERE f.id IN (${Prisma.join(ids)}) AND request."projectId" IN (${Prisma.join(projectIds)})
      AND f.fingerprint LIKE 'outcome:v1:%' AND source.state = 'FLAG' AND ${supersededOutcomeReceiptSql}
      AND source.evidence #> '{incident,flagIds}' @> jsonb_build_array(f.id)
  `
  return new Set(rows.filter(row => outcomeFlagOwner(row.fingerprint)?.outcomeId === row.outcomeId).map(row => row.id))
}
