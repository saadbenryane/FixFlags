import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { outcomeFlagOwner } from '@/lib/audit/flag-identity'
import { createRecordedRecoveryReader, type RecoveryFlag } from '@/lib/audit/recovery-evidence'
import { readOutcomeIncident } from '@/lib/sites/domain/outcome-incident'
import { siteAnalysisAuditWhere } from './analysis-scope'

export function unboundSiteFindingWhere(projects: string | string[]): Prisma.FlagWhereInput {
  return { audit: { projectId: typeof projects === 'string' ? projects : { in: projects }, ...siteAnalysisAuditWhere },
    improvementOccurrence: null, status: { in: ['OPEN', 'REGRESSED', 'FIXED'] } }
}

/** Workflow completion alone cannot hide unresolved or unproven occurrences. */
export const currentImprovementWhere = { OR: [
  { status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'READY_TO_VERIFY', 'UNVERIFIED'] } },
  { status: 'VERIFIED', occurrences: { some: { flag: { status: { in: ['OPEN', 'REGRESSED', 'FIXED'] } } } } },
] } satisfies Prisma.ImprovementWhereInput

type IncidentFlag = RecoveryFlag & { id?: string; auditId?: string | null; fingerprint?: string | null; status?: string | null; resolvedInId?: string | null }
type RecoveryCertificate = { outcomeId: string; incidentRunRequestId: string; flagIds: Set<string> }

function supersededAssessment(evidence: unknown) {
  return Boolean(evidence && typeof evidence === 'object' && !Array.isArray(evidence) &&
    typeof (evidence as { supersededByAssessmentId?: unknown }).supersededByAssessmentId === 'string' &&
    (evidence as { supersededByAssessmentId: string }).supersededByAssessmentId.length > 0)
}

/** The committed recovery transition is the certificate. A later clear, a
 * superseded receipt, or another outcome does not resolve these flags. */
function recoveryCertificates(assessments: Array<{ state: string; outcomeId: string; evidence: unknown }> | undefined): RecoveryCertificate[] {
  const certificates: RecoveryCertificate[] = []
  for (const row of assessments ?? []) {
    if (row.state !== 'CLEAR' || supersededAssessment(row.evidence)) continue
    const incident = readOutcomeIncident(row.evidence)
    if (incident?.transition !== 'recovery' || !incident.incidentRunRequestId) continue
    certificates.push({ outcomeId: row.outcomeId, incidentRunRequestId: incident.incidentRunRequestId, flagIds: new Set(incident.recoveredFlagIds) })
  }
  return certificates
}

function namedByRecovery(flag: IncidentFlag, certificates: RecoveryCertificate[]) {
  const owner = outcomeFlagOwner(flag.fingerprint)
  return Boolean(owner && flag.id && certificates.some(certificate => certificate.outcomeId === owner.outcomeId && certificate.flagIds.has(flag.id!)))
}

/** Batch recovery provenance once for the authorized projects. A pointer to
 * another tenant's completed Audit cannot clear this project's incident. */
export async function loadIncidentRecoveryProofs(groups: Array<{ projectId: string; flags: IncidentFlag[] }>) {
  const ids = [...new Set(groups.flatMap(group => group.flags.flatMap(flag =>
    flag.status === 'FIXED' && flag.resolvedInId ? [flag.resolvedInId] : [])))]
  type Proofs = Map<string, Date> & { hasFlag: (flag: { id?: string; resolvedInId?: string | null }) => boolean }
  const byProject = new Map<string, Proofs>()
  const provenFlagsByProject = new Map<string, Set<string>>()
  if (!ids.length) return byProject
  const projectIds = [...new Set(groups.map(group => group.projectId))]
  const flagsByRecovery = new Map<string, IncidentFlag[]>()
  for (const group of groups) for (const flag of group.flags) {
    if (!flag.id || flag.status !== 'FIXED' || !flag.resolvedInId) continue
    const key = JSON.stringify([group.projectId, flag.resolvedInId])
    const flags = flagsByRecovery.get(key)
    if (flags) flags.push(flag)
    else flagsByRecovery.set(key, [flag])
  }
  const audits = await prisma.audit.findMany({ where: { id: { in: ids }, projectId: { in: projectIds },
    status: 'COMPLETED', completedAt: { not: null } }, select: { id: true, projectId: true, completedAt: true, executionSpec: true,
      outcomeAssessments: { select: { state: true, outcomeId: true, evidence: true } },
      verifierExecutions: { where: { status: 'COMPLETED', OR: [{ targetKey: { startsWith: 'module:' } }, { targetKey: { startsWith: 'check:' } }] },
        select: { targetKey: true, status: true, detail: true } } } })
  const certificatesByAudit = new Map<string, RecoveryCertificate[]>()
  const remember = (projectId: string, flagId: string, auditId: string, at: Date) => {
    const keys = provenFlagsByProject.get(projectId) ?? new Set<string>()
    keys.add(`${flagId}:${auditId}`)
    provenFlagsByProject.set(projectId, keys)
    const proofs: Proofs = byProject.get(projectId) ?? Object.assign(new Map<string, Date>(), {
      hasFlag: (flag: { id?: string; resolvedInId?: string | null }) => keys.has(`${flag.id}:${flag.resolvedInId}`),
    })
    proofs.set(auditId, at)
    byProject.set(projectId, proofs)
  }
  for (const audit of audits) if (audit.projectId && audit.completedAt) {
    const certificates = recoveryCertificates(audit.outcomeAssessments)
    certificatesByAudit.set(audit.id, certificates)
    const recovery = createRecordedRecoveryReader({ auditId: audit.id, executionSpec: audit.executionSpec,
      executions: audit.verifierExecutions ?? [] })
    for (const flag of flagsByRecovery.get(JSON.stringify([audit.projectId, audit.id])) ?? []) {
      if (!recovery.hasRecovery(flag) &&
        !namedByRecovery(flag, certificates)) continue
      remember(audit.projectId, flag.id!, audit.id, audit.completedAt)
    }
  }
  const pending = groups.flatMap(group => group.flags.flatMap(flag => {
    const owner = outcomeFlagOwner(flag.fingerprint)
    return flag.id && flag.auditId && owner && flag.status === 'FIXED' && flag.resolvedInId &&
      !provenFlagsByProject.get(group.projectId)?.has(`${flag.id}:${flag.resolvedInId}`) ? [{ projectId: group.projectId, owner, flag }] : []
  }))
  if (pending.length) {
    const membership = await prisma.outcomeAssessment.findMany({ where: {
      auditId: { in: [...new Set(pending.map(item => item.flag.auditId!))] }, audit: { projectId: { in: projectIds } } },
      select: { auditId: true, outcomeId: true, evidence: true, audit: { select: { projectId: true } } } })
    const auditsById = new Map(audits.map(audit => [audit.id, audit]))
    const members = new Set(membership.flatMap(row => {
      const incident = readOutcomeIncident(row.evidence)?.incidentRunRequestId
      return incident ? [JSON.stringify([row.audit.projectId, row.auditId, row.outcomeId, incident])] : []
    }))
    for (const item of pending) {
      const audit = auditsById.get(item.flag.resolvedInId!)
      if (!audit?.completedAt || audit.projectId !== item.projectId) continue
      const certificates = audit ? certificatesByAudit.get(audit.id) ?? [] : []
      const member = certificates.some(certificate => certificate.outcomeId === item.owner.outcomeId &&
        members.has(JSON.stringify([item.projectId, item.flag.auditId, item.owner.outcomeId, certificate.incidentRunRequestId])))
      if (member) remember(item.projectId, item.flag.id!, audit.id, audit.completedAt)
    }
  }
  return byProject
}
