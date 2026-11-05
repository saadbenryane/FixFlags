import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { currentIncidentFlags } from '../flag-resolution'
import { incidentRecoveryFlagSelect, loadIncidentRecoveryProofs, unboundSiteFindingWhere } from './incident-proofs'
import { SiteRunRefusal } from './run-refusal'
import { loadAcceptedFlagRecoveries } from './accepted-flag-recoveries'

const SOURCE_BATCH = 128
const INCIDENT_BATCH = 32
const sourceSelect = { id: true, auditId: true, createdAt: true, checkId: true, rubric: true, severity: true,
  impactTag: true, pageUrl: true, status: true, resolvedInId: true, confidence: true, affectedPaths: true,
  fingerprint: true, attentionPolicy: true } satisfies Prisma.FlagSelect
type Source = Prisma.FlagGetPayload<{ select: typeof sourceSelect }>
type CurrentFindingSource = Omit<Source, 'status'> & { status: string }
type Incident = { id: string; projectId: string; status: string; fingerprint?: string }
type Occurrence = { createdAt: Date; flag: CurrentFindingSource }

/** History contributes scope and independent proof, never a second copy of every
 * diagnosis and repair. Only current sources survive each bounded history batch. */
export async function loadCurrentFindingSources(projectIds: string[], incidents: Incident[], options: { includeUnbound?: boolean } = {}) {
  const includeUnbound = options.includeUnbound !== false
  const byImprovement = new Map(incidents.map(incident => [incident.id, [] as Occurrence[]]))
  const represented = new Set<string>()
  const unbound = new Map(projectIds.map(projectId => [projectId, [] as CurrentFindingSource[]]))
  const incidentById = new Map(incidents.map(incident => [incident.id, incident]))
  const incidentByFingerprint = new Map(incidents.filter(incident => incident.fingerprint)
    .map(incident => [JSON.stringify([incident.projectId, incident.fingerprint]), incident]))
  const prove = async (groups: Array<{ projectId: string; flags: Source[] }>) => {
    const fixedIds = groups.flatMap(group => group.flags.flatMap(flag => flag.status === 'FIXED' && flag.resolvedInId ? [flag.id] : []))
    const evidence = fixedIds.length ? await prisma.flag.findMany({
      where: { id: { in: fixedIds }, audit: { projectId: { in: groups.map(group => group.projectId) } } },
      select: incidentRecoveryFlagSelect,
    }) : []
    const byId = new Map(evidence.map(flag => [flag.id, flag]))
    if (fixedIds.some(id => !byId.has(id))) throw new SiteRunRefusal('Finding evidence changed. Try again.', 409)
    return loadIncidentRecoveryProofs(groups.map(group => ({ ...group,
      flags: group.flags.map(flag => ({ ...flag, ...byId.get(flag.id) })),
    })))
  }
  const seen = new Map(projectIds.map(projectId => [projectId, new Set<string>()]))
  for (let projectOffset = 0; projectOffset < projectIds.length; projectOffset += INCIDENT_BATCH) {
    const projects = projectIds.slice(projectOffset, projectOffset + INCIDENT_BATCH)
    const owned = incidents.filter(incident => projects.includes(incident.projectId))
    if (!owned.length && !includeUnbound) continue
    for (let offset = 0; offset < Math.max(owned.length, 1); offset += INCIDENT_BATCH) {
      const selected = owned.slice(offset, offset + INCIDENT_BATCH)
      let cursor: string | undefined
      for (;;) {
        const rows = await prisma.flag.findMany({ where: { OR: [
          ...selected.map(incident => ({ audit: { projectId: incident.projectId }, improvementOccurrence: {
            improvementId: incident.id, audit: { projectId: incident.projectId }, improvement: { projectId: incident.projectId },
          } })),
          ...(offset === 0 && includeUnbound ? [unboundSiteFindingWhere(projects)] : []),
        ] }, select: { ...sourceSelect, audit: { select: { projectId: true } },
          improvementOccurrence: { select: { improvementId: true, createdAt: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: SOURCE_BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        })
        const groups = new Map<string, typeof rows>()
        for (const row of rows) if (row.audit.projectId) {
          const flags = groups.get(row.audit.projectId) ?? []
          flags.push(row); groups.set(row.audit.projectId, flags)
        }
        const proofs = await prove([...groups].map(([projectId, flags]) => ({ projectId, flags })))
        const legacy = new Map((await Promise.all([...groups].map(async ([projectId, flags]) => {
          const targets = flags.flatMap(flag => {
            const incident = flag.improvementOccurrence ? incidentById.get(flag.improvementOccurrence.improvementId)
              : incidentByFingerprint.get(JSON.stringify([projectId, flag.fingerprint]))
            return flag.status === 'OPEN' && incident ? [{ ...flag, improvementId: incident.id }] : []
          })
          return [projectId, await loadAcceptedFlagRecoveries(projectId, targets)] as const
        }))))
        for (const [projectId, flags] of groups) for (const row of flags) {
          const occurrence = row.improvementOccurrence
          if (occurrence) {
            represented.add(occurrence.improvementId)
            if (legacy.get(projectId)?.has(row.id)) continue
            const current = currentIncidentFlags([row], proofs.get(projectId) ?? new Set<string>())[0]
            const incident = incidentById.get(occurrence.improvementId)!
            if (current) byImprovement.get(incident.id)!.push({ createdAt: occurrence.createdAt, flag: { ...current, status: current.status! } })
          } else {
            if (legacy.get(projectId)?.has(row.id)) continue
            const current = currentIncidentFlags([row], proofs.get(projectId) ?? new Set<string>())[0]
            if (!current) continue
            const key = row.fingerprint ? 'fingerprint:' + row.fingerprint : 'flag:' + row.id
            if (seen.get(projectId)!.has(key)) continue
            seen.get(projectId)!.add(key); unbound.get(projectId)!.push(current)
          }
        }
        if (rows.length < SOURCE_BATCH) break
        cursor = rows.at(-1)!.id
      }
    }
  }
  for (const rows of byImprovement.values()) rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.flag.id.localeCompare(a.flag.id))
  return { byImprovement, represented, unbound }
}
