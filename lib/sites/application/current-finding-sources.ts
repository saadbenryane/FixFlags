import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { currentIncidentFlags } from '../flag-resolution'
import { incidentRecoveryFlagSelect, loadIncidentRecoveryProofs, unboundSiteFindingWhere } from './incident-proofs'
import { SiteRunRefusal } from './run-refusal'
import { loadAcceptedFlagRecoveries } from './accepted-flag-recoveries'
import { baseCheckId, outcomeFlagOwner } from '@/lib/audit/flag-identity'
import { performanceLabFamily, recordedPerformanceLabScope } from '@/lib/audit/performance-measurement'
import { readExecutionSpec } from '../domain/execution-spec'
import { loadConfirmedOutcomeFlagIds } from './outcome-finding-sources'

const SOURCE_BATCH = 128
const INCIDENT_BATCH = 32
const sourceSelect = { id: true, auditId: true, createdAt: true, checkId: true, rubric: true, severity: true,
  impactTag: true, pageUrl: true, status: true, resolvedInId: true, confidence: true, affectedPaths: true,
  fingerprint: true, attentionPolicy: true } satisfies Prisma.FlagSelect
type Source = Prisma.FlagGetPayload<{ select: typeof sourceSelect }>
type CurrentFindingSource = Omit<Source, 'status'> & { status: string }
type Incident = { id: string; projectId: string; status: string; fingerprint?: string }
type Occurrence = { createdAt: Date; flag: CurrentFindingSource }

/** Compare only Sites with competing active severity bands. Newer evidence
 * must cover every original measurement before its old band can leave the board. */
async function supersededPerformanceSources(byProject: Map<string, CurrentFindingSource[]>) {
  const candidates = [...byProject].flatMap(([projectId, flags]) => {
    const grouped = Map.groupBy(flags.flatMap(flag => {
      const family = performanceLabFamily(flag.checkId)
      const band = baseCheckId(flag.checkId)
      return family && band && ['OPEN', 'REGRESSED'].includes(flag.status) && !outcomeFlagOwner(flag.fingerprint)
        ? [{ id: flag.id, band, key: `${family.module}:${family.metric}` }] : []
    }), flag => flag.key)
    return [...grouped.values()].filter(group => new Set(group.map(flag => flag.band)).size > 1)
      .flatMap(group => group.map(flag => ({ id: flag.id, projectId })))
  })
  const qualified: Array<{ id: string; band: string; at: number; keys: string[] }> = []
  for (let offset = 0; offset < candidates.length; offset += SOURCE_BATCH) {
    const batch = candidates.slice(offset, offset + SOURCE_BATCH)
    const scopes = Map.groupBy(batch, flag => flag.projectId)
    const rows = await prisma.flag.findMany({ where: { status: { in: ['OPEN', 'REGRESSED'] }, OR: [...scopes].map(([projectId, flags]) => ({
      id: { in: flags.map(flag => flag.id) }, audit: { projectId, status: 'COMPLETED' },
    })) }, select: { id: true, checkId: true, verificationRule: true, evidenceTargets: true, supportingObservations: true,
      audit: { select: { projectId: true, createdAt: true, executionSpec: true } } } })
    for (const row of rows) {
      const band = baseCheckId(row.checkId), scope = recordedPerformanceLabScope(row), spec = readExecutionSpec(row.audit.executionSpec)
      const version = band && spec?.checks[band]
      if (!scope || !band || !version || spec?.engine !== 'progressive-v1' || spec.scope === 'FIXTURE_SETUP') continue
      qualified.push({ id: row.id, band, at: row.audit.createdAt.getTime(), keys: [...scope.conditions].map(condition =>
        JSON.stringify([row.audit.projectId, spec.environment, version, scope.module, condition])) })
    }
  }
  const newest = new Map<string, { at: number; bands: Set<string> }>()
  for (const flag of qualified) for (const key of flag.keys) {
    const prior = newest.get(key)
    if (!prior || flag.at > prior.at) newest.set(key, { at: flag.at, bands: new Set([flag.band]) })
    else if (flag.at === prior.at) prior.bands.add(flag.band)
  }
  return new Set(qualified.filter(flag => flag.keys.every(key => {
    const later = newest.get(key)
    return later && later.at > flag.at && later.bands.size === 1 && !later.bands.has(flag.band)
  })).map(flag => flag.id))
}

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
        const [proofs, confirmedOutcomeFlags] = await Promise.all([
          prove([...groups].map(([projectId, flags]) => ({ projectId, flags }))),
          loadConfirmedOutcomeFlagIds(rows.map(row => ({ id: row.id, fingerprint: row.fingerprint, projectId: row.audit.projectId }))),
        ])
        const legacy = new Map((await Promise.all([...groups].map(async ([projectId, flags]) => {
          const targets = flags.flatMap(flag => {
            if (outcomeFlagOwner(flag.fingerprint) && !confirmedOutcomeFlags.has(flag.id)) return []
            const incident = flag.improvementOccurrence ? incidentById.get(flag.improvementOccurrence.improvementId)
              : incidentByFingerprint.get(JSON.stringify([projectId, flag.fingerprint]))
            return flag.status === 'OPEN' && incident ? [{ ...flag, improvementId: incident.id }] : []
          })
          return [projectId, await loadAcceptedFlagRecoveries(projectId, targets)] as const
        }))))
        for (const [projectId, flags] of groups) for (const row of flags) {
          const occurrence = row.improvementOccurrence
          if (occurrence) represented.add(occurrence.improvementId)
          if (outcomeFlagOwner(row.fingerprint) && !confirmedOutcomeFlags.has(row.id)) continue
          if (occurrence) {
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
  if (includeUnbound) {
    const byProject = new Map([...unbound].map(([projectId, flags]) => [projectId, [...flags]]))
    for (const incident of incidents) for (const { flag } of byImprovement.get(incident.id) ?? []) byProject.get(incident.projectId)?.push(flag)
    const superseded = await supersededPerformanceSources(byProject)
    // Keep complete repair cohorts for any visible Improvement. Exact history
    // and direct Improvement detail still use their original occurrence scope.
    for (const [id, rows] of byImprovement) if (rows.length && rows.every(row => superseded.has(row.flag.id))) byImprovement.set(id, [])
    for (const [projectId, flags] of unbound) unbound.set(projectId, flags.filter(flag => !superseded.has(flag.id)))
  }
  for (const rows of byImprovement.values()) rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.flag.id.localeCompare(a.flag.id))
  return { byImprovement, represented, unbound }
}
