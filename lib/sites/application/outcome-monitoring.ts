import { prisma } from '@/lib/db'
import { readExecutionSpec } from '../domain/execution-spec'
import { readOutcomeIncident } from '../domain/outcome-incident'
import type { FlagDiffSummaryItem } from '@/lib/audit/flag-types'

/** Notification retries and report comparisons read the committed transition,
 * rather than comparing a scoped run against unrelated report Flags. */
export async function outcomeMonitoringDiff(auditId: string, loaded?: { projectId: string | null; executionSpec: unknown; outcomeAssessments: Array<{ evidence: unknown }> }) {
  const audit = loaded ?? await prisma.audit.findUnique({ where: { id: auditId }, select: {
    projectId: true, executionSpec: true,
    outcomeAssessments: { select: { evidence: true } },
  } })
  if (!audit?.projectId || readExecutionSpec(audit.executionSpec)?.scope !== 'OUTCOMES') return null
  const incidents = audit.outcomeAssessments.map(row => readOutcomeIncident(row.evidence))
  if (!incidents.length || incidents.some(incident => !incident)) return null
  const groups = { fixed: [] as string[], inconclusive: [] as string[], unchanged: [] as string[], regressed: [] as string[], newIssues: [] as string[] }
  for (const incident of incidents) {
    if (!incident) continue
    if (incident.transition === 'recovery') groups.fixed.push(...incident.recoveredFlagIds)
    if (incident.transition === 'unknown') groups.inconclusive.push(...incident.rootFlagIds)
    if (incident.transition === 'ongoing_failure') groups.unchanged.push(...incident.flagIds)
    if (incident.transition === 'regression') groups.regressed.push(...incident.flagIds)
    if (incident.transition === 'failure') groups.newIssues.push(...incident.flagIds)
  }
  const ids = [...new Set(Object.values(groups).flat())]
  const flags = ids.length ? await prisma.flag.findMany({ where: { id: { in: ids }, audit: { projectId: audit.projectId } },
    select: { id: true, checkId: true, problem: true, rubric: true, severity: true, status: true,
      confidence: true, impactTag: true, attentionPolicy: true, pageUrl: true } }) : []
  const byId = new Map(flags.map(flag => [flag.id, flag]))
  const project = (values: string[]): FlagDiffSummaryItem[] => [...new Set(values)].flatMap(id => byId.get(id) ?? [])
  return { fixed: project(groups.fixed), inconclusive: project(groups.inconclusive), unchanged: project(groups.unchanged),
    regressed: project(groups.regressed), newIssues: project(groups.newIssues) }
}
