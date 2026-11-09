import type { PrismaClient } from '@prisma/client'
import { MIN_PUBLIC_RESEARCH_SITES } from '@/lib/graph/public-research'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { RESEARCH_CONSENT_EVENT } from './research-consent-contract'
import { countResearchObservations, hasScopedResearchGrant, permittedResearchAuditHostname, publicResearchAuditAccess } from './research-sources'
import { corroboratedResearchVersions } from './research-versions'
import { readResearchRecoveryCandidate, type ResearchRecoverySource } from './research-recovery-readiness'
import { readResearchPageResponseCoverage } from './research-page-response-coverage'
import { countResearchGroups, researchIndependenceGroups } from './research-independence'

const MAX_SOURCES = 5_000
const MAX_FLAGS = 50_000

type CurrentGrantRow = {
  projectId: string
  projectOwner: string
  ownerLifecycleRevision: number
  watchTargetRevision: number
  projectUrl: string
  id: string
  userId: string | null
  version: number
  properties: unknown
  createdAt: Date
}

/** Private planning snapshot. A candidate never supplies release approval. */
export async function inspectResearchReadiness(input: {
  start: Date; end: Date; checkedAt?: Date; includeRecoveries?: boolean; includePageResponseCoverage?: boolean
}, db: Pick<PrismaClient, '$transaction'>) {
  const checkedAt = input.checkedAt ?? new Date()
  const { start, end } = input
  if (![start, end, checkedAt].every(date => Number.isFinite(date.getTime())) || start > end || end > checkedAt) {
    throw new Error('Invalid research observation window')
  }
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    // Apply the current choice before any historical window. A later withdrawal
    // or regrant must not restore evidence from an earlier window.
    const grants = await tx.$queryRaw<CurrentGrantRow[]>`
      SELECT DISTINCT ON (event."projectId") event."projectId", project."userId" AS "projectOwner", project.url AS "projectUrl",
        project."watchTargetRevision", account."lifecycleRevision" AS "ownerLifecycleRevision",
        event.id, event."userId", event.version, event.properties, event."createdAt"
      FROM site_lifecycle_events event
      JOIN projects project ON project.id = event."projectId" AND project."deletedAt" IS NULL
      JOIN users account ON account.id = project."userId" AND account."lifecycleStatus" = 'ACTIVE'
      WHERE event.name = ${RESEARCH_CONSENT_EVENT}
      ORDER BY event."projectId", event."createdAt" DESC, event.id DESC
      LIMIT ${MAX_SOURCES + 1}
    `
    if (grants.length > MAX_SOURCES) throw new Error('Research grants exceed reporting limit')
    const permitted = new Map(grants.flatMap(grant => {
      const project = { id: grant.projectId, userId: grant.projectOwner, url: grant.projectUrl,
        watchTargetRevision: grant.watchTargetRevision,
        user: { lifecycleStatus: 'ACTIVE' as const, lifecycleRevision: grant.ownerLifecycleRevision } }
      return grant.createdAt <= checkedAt && hasScopedResearchGrant(project, grant)
        ? [[project.id, { project, grant }] as const] : []
    }))
    const audits = permitted.size ? await tx.audit.findMany({
      where: { projectId: { in: [...permitted.keys()] }, status: 'COMPLETED',
        createdAt: { gte: start, lte: end }, completedAt: { lte: end }, ...publicResearchAuditAccess },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_SOURCES + 1,
      select: { id: true, projectId: true, userId: true, url: true, status: true, createdAt: true, completedAt: true },
    }) : []
    if (audits.length > MAX_SOURCES) throw new Error('Research audits exceed reporting limit')
    const sources = new Map<string, ResearchRecoverySource & { createdAt: Date; completedAt: Date | null; auditUrl: string }>()
    for (const audit of audits) {
      const owner = audit.projectId ? permitted.get(audit.projectId) : undefined
      const hostname = owner ? permittedResearchAuditHostname(owner.project, owner.grant, audit, { start, end }) : null
      if (owner && hostname) sources.set(audit.id, { hostname, ownerId: owner.project.userId,
        createdAt: audit.createdAt, completedAt: audit.completedAt, siteUrl: owner.project.url, auditUrl: audit.url,
        earliestRequestAt: new Date(Math.max(start.getTime(), owner.grant.createdAt.getTime())) })
    }
    const eligibleSites = new Set([...sources.values()].map(source => source.hostname)).size
    const groups = researchIndependenceGroups(sources)
    const independenceFloorMet = new Set(groups.values()).size >= MIN_PUBLIC_RESEARCH_SITES
    const checkedIssueCohorts = eligibleSites >= MIN_PUBLIC_RESEARCH_SITES && independenceFloorMet
    const flags = checkedIssueCohorts ? await tx.flag.findMany({
      where: { auditId: { in: [...sources.keys()] }, source: 'DETERMINISTIC',
        confidence: { gte: 0.8, lte: 1 }, createdAt: { lte: checkedAt } },
      take: MAX_FLAGS + 1,
      select: { id: true, auditId: true, checkId: true, source: true, confidence: true, createdAt: true },
    }) : []
    if (flags.length > MAX_FLAGS) throw new Error('Research findings exceed reporting limit')
    const observations = countResearchObservations(flags, sources, checkedAt)
    const eligibleIssues = [...observations].filter(([, count]) => count.sites.size >= MIN_PUBLIC_RESEARCH_SITES &&
      countResearchGroups(count.audits, groups) >= MIN_PUBLIC_RESEARCH_SITES)
      .sort(([a], [b]) => a.localeCompare(b))
    const versions = await corroboratedResearchVersions(tx, eligibleIssues.flatMap(([, count]) => [...count.flags]), checkedAt, sources)
    const flagsById = new Map(flags.map(flag => [flag.id, flag]))
    const candidates = eligibleIssues.map(([checkId, count]) => {
      const cohorts = new Map<number, { sites: Set<string>; audits: Set<string>; observations: number }>()
      for (const flagId of count.flags) {
        const version = versions.get(flagId)?.version
        const flag = flagsById.get(flagId)
        const source = flag ? sources.get(flag.auditId) : undefined
        if (version === undefined || !flag || !source) continue
        const cohort = cohorts.get(version) ?? { sites: new Set<string>(), audits: new Set<string>(), observations: 0 }
        cohort.sites.add(source.hostname)
        cohort.audits.add(flag.auditId)
        cohort.observations++
        cohorts.set(version, cohort)
      }
      return { checkId, affectedSites: count.sites.size, observations: count.flags.size,
        corroboratedVersions: [...cohorts].filter(([, cohort]) => cohort.sites.size >= MIN_PUBLIC_RESEARCH_SITES &&
          countResearchGroups(cohort.audits, groups) >= MIN_PUBLIC_RESEARCH_SITES)
          .sort(([a], [b]) => a - b)
          .map(([checkVersion, cohort]) => ({ checkVersion, affectedSites: cohort.sites.size, observations: cohort.observations,
            matchesRegisteredVersion: checkVersion === CHECK_REGISTRY[checkId].version })),
      }
    })
    const nativeRecovery = input.includeRecoveries ? {
      checked: checkedIssueCohorts,
      candidate: checkedIssueCohorts ? await readResearchRecoveryCandidate(tx, { start, end }, sources, groups) : null,
      limitation: 'Private readiness for the current default public availability evaluator. Only consented, comparable observations inside the same window count. Follow-up and recurrence cells report only whether they meet the site floor.',
    } : undefined
    const pageResponseCoverage = input.includePageResponseCoverage
      ? (await readResearchPageResponseCoverage(tx, sources, checkedAt)).coverage : undefined
    return {
      version: 1,
      source: 'current-research-permissions-and-retained-findings',
      observationWindow: { start: start.toISOString(), end: end.toISOString() },
      checkedAt: checkedAt.toISOString(),
      databaseWritten: false,
      publicationApproved: false,
      minimumDistinctSites: MIN_PUBLIC_RESEARCH_SITES,
      independenceFloorMet,
      counts: { activeScopedGrants: permitted.size, eligibleAudits: sources.size, eligibleSites },
      checkedIssueCohorts,
      candidates,
      ...(nativeRecovery && { nativeRecovery }),
      ...(pageResponseCoverage && { pageResponseCoverage }),
      limitations: [
        'Current scoped grants apply prospectively. The window covers source audits and the snapshot includes retained observations through its check time.',
        'Version cohorts require a matching supporting observation, committed task finding, and completed module receipt. Missing or mixed evidence stays in the general candidate count only.',
        'The sample and reported issue, version, coverage, and recovery cells require separate owner and hostname groups. Linked audits contribute one group.',
        'Matching versions do not establish detector accuracy, coverage, prevalence, privacy review, or publication permission.',
        'This snapshot omits source identities and does not create a manifest or a release. Independently verified recovery is evaluated only when requested.',
      ],
    }
  }, { isolationLevel: 'RepeatableRead' })
}
