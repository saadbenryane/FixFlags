import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { captureObservationScopeSchema } from '@/lib/audit/browser/observation-scope'
import { isPermittedPublicResearchCheck, MIN_PUBLIC_RESEARCH_SITES, PUBLIC_RESEARCH_PATH, type PublicIssueResearch } from '@/lib/graph/public-research'
import { RESEARCH_CONSENT_EVENT } from './research-consent-contract'
import { countResearchObservations, hasScopedResearchGrant, permittedResearchAuditHostname, publicResearchAuditAccess, researchPublicTargetMatchesSite } from './research-sources'
import { corroboratedResearchVersions } from './research-versions'
import { PAGE_RESPONSE_RESEARCH_CHECKS, readResearchPageResponseCoverage } from './research-page-response-coverage'
import { countResearchGroups, researchIndependenceGroups, type ResearchIndependenceSource } from './research-independence'
import { researchConsentSiteSelect } from './research-consent'

export const RESEARCH_PERMISSIONS_PATH = `${PUBLIC_RESEARCH_PATH}/permissions`
export const RESEARCH_PERMISSIONS_KIND = 'approved-private-research-permissions-v1'
const MAX_OBSERVATIONS = 50_000
const id = z.string().min(1).max(200)
const reviewDigest = z.string().regex(/^[a-f0-9]{64}$/)
export const researchPermissionsSchema = z.strictObject({
  version: z.literal(1),
  evidenceRef: z.string().min(1).max(4_000),
  sources: z.array(z.strictObject({ projectId: id, grantId: id, auditId: id })).min(1).max(5_000),
  reviewedInputSha256: reviewDigest.optional(),
  reviewedEvidenceSha256: reviewDigest.optional(),
}).refine((value) => new Set(value.sources.map((source) => source.auditId)).size === value.sources.length)
export type ResearchPermissionsManifest = z.infer<typeof researchPermissionsSchema>
type ResearchReadDatabase = {
  [Table in 'project' | 'siteLifecycleEvent' | 'audit' | 'flag' | 'auditTechnologyObservation']:
    Pick<Prisma.TransactionClient[Table], 'findMany'>
}

/** Hash the schema-validated inputs, excluding the reviewer's recorded digest. */
export function researchReleaseInputSha256(dataset: PublicIssueResearch, manifest: ResearchPermissionsManifest) {
  const { version, evidenceRef, sources } = manifest
  return createHash('sha256').update(JSON.stringify([dataset, { version, evidenceRef, sources }])).digest('hex')
}

/** Run in the same snapshot as the approved public artifact read. */
export async function hasCurrentResearchPermissions(dataset: PublicIssueResearch,
  db: ResearchReadDatabase & Pick<Prisma.TransactionClient, '$queryRaw'> & {
    growthArtifact: Pick<Prisma.TransactionClient['growthArtifact'], 'findUnique'>
  }): Promise<boolean> {
  // Connected search context cannot be repurposed under this browser-evidence grant.
  if (!dataset.issues.length || dataset.issues.some(issue => !isPermittedPublicResearchCheck(issue.checkId))) return false
  const artifact = await db.growthArtifact.findUnique({
    where: { path: RESEARCH_PERMISSIONS_PATH }, select: { kind: true, payload: true },
  })
  if (artifact?.kind !== RESEARCH_PERMISSIONS_KIND) return false
  const parsed = researchPermissionsSchema.safeParse(artifact.payload)
  if (!parsed.success || !parsed.data.reviewedEvidenceSha256) return false
  const inputSha256 = researchReleaseInputSha256(dataset, parsed.data)
  if (parsed.data.reviewedInputSha256 !== inputSha256) return false
  const evidence = await readResearchReleaseEvidence(dataset, parsed.data, db)
  if (!evidence) return false
  const review = await reviewResearchReleaseEvidence(dataset, evidence, inputSha256, db)
  return review.evidenceSha256 === parsed.data.reviewedEvidenceSha256
}

type ManifestCohort = {
  manifest: ResearchPermissionsManifest
  window: { start: Date; end: Date }
  expectedSampleSites?: number
  includeFrameworkCells?: boolean
}

/** Resolve the supplied cohort under current permission without choosing sources. */
export async function readResearchManifestCohort(input: ManifestCohort, db: ResearchReadDatabase) {
  const { manifest, window, expectedSampleSites, includeFrameworkCells: hasFrameworkCells = false } = input
  const { sources } = manifest
  const projectIds = [...new Set(sources.map((source) => source.projectId))]
  const [projects, grants, audits] = await Promise.all([
    db.project.findMany({ where: { id: { in: projectIds }, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
      select: researchConsentSiteSelect }),
    db.siteLifecycleEvent.findMany({
      where: { projectId: { in: projectIds }, name: RESEARCH_CONSENT_EVENT },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], distinct: ['projectId'],
      select: { id: true, projectId: true, userId: true, version: true, properties: true, createdAt: true },
    }),
    db.audit.findMany({
      where: { id: { in: sources.map((source) => source.auditId) }, ...publicResearchAuditAccess },
      select: { id: true, projectId: true, userId: true, url: true, status: true, createdAt: true, completedAt: true,
        technologyDetectionStatus: hasFrameworkCells, technologyDetectedAt: hasFrameworkCells,
        technologyDetectorVersion: hasFrameworkCells, technologyObservationScope: hasFrameworkCells },
    }),
  ])
  const owners = new Map(projects.map((project) => [project.id, project]))
  const currentGrants = new Map(grants.map((grant) => [grant.projectId, grant]))
  const sourceAudits = new Map(audits.map((audit) => [audit.id, audit]))
  const hostnames = new Set<string>()
  const sourceEvidence = new Map<string, ResearchIndependenceSource & {
    createdAt: Date; siteUrl: string; auditUrl: string; completedAt: Date | null; grantedAt: Date
  }>()
  for (const source of sources) {
    const project = owners.get(source.projectId)
    const grant = currentGrants.get(source.projectId)
    const audit = sourceAudits.get(source.auditId)
    if (!project || !grant || grant.id !== source.grantId || !hasScopedResearchGrant(project, grant) || !audit) return null
    const hostname = permittedResearchAuditHostname(project, grant, audit, window)
    if (!hostname) return null
    hostnames.add(hostname)
    sourceEvidence.set(audit.id, { hostname, ownerId: project.userId, createdAt: audit.createdAt, siteUrl: project.url, auditUrl: audit.url,
      completedAt: audit.completedAt, grantedAt: grant.createdAt })
  }
  if (expectedSampleSites !== undefined && hostnames.size !== expectedSampleSites) return null
  const groups = researchIndependenceGroups(sourceEvidence)
  if (new Set(groups.values()).size < MIN_PUBLIC_RESEARCH_SITES) return null
  return { sampleSites: hostnames.size, groups, sourceEvidence, audits }
}

export async function readResearchManifestEvidence(input: ManifestCohort & { observedBy: Date }, db: ResearchReadDatabase) {
  const cohort = await readResearchManifestCohort(input, db)
  if (!cohort) return null
  const flags = await db.flag.findMany({
    where: { auditId: { in: [...cohort.sourceEvidence.keys()] }, source: 'DETERMINISTIC',
      confidence: { gte: 0.8, lte: 1 }, createdAt: { lte: input.observedBy } },
    select: { id: true, auditId: true, checkId: true, source: true, confidence: true, createdAt: true },
    take: MAX_OBSERVATIONS + 1,
  })
  if (flags.length > MAX_OBSERVATIONS) return null
  return { ...cohort, flags, observations: countResearchObservations(flags, cohort.sourceEvidence, input.observedBy) }
}

/** Resolve the exact private manifest and check all released counts. */
export async function readResearchReleaseEvidence(
  dataset: PublicIssueResearch, manifest: ResearchPermissionsManifest, db: ResearchReadDatabase,
) {
  if (manifest.evidenceRef !== dataset.evidenceRef || dataset.issues.some(issue => !isPermittedPublicResearchCheck(issue.checkId))) return null
  const hasFrameworkCells = dataset.issues.some(issue => issue.topFrameworks.length > 0)
  const cohort = await readResearchManifestEvidence({
    manifest,
    window: { start: new Date(dataset.windowStart), end: new Date(dataset.windowEnd) },
    observedBy: new Date(dataset.reviewedAt),
    expectedSampleSites: dataset.sampleSiteCount,
    includeFrameworkCells: hasFrameworkCells,
  }, db)
  if (!cohort) return null
  const { observations, sourceEvidence, flags, groups, audits } = cohort
  const technologies = hasFrameworkCells
    ? await db.auditTechnologyObservation.findMany({
      where: { auditId: { in: [...sourceEvidence.keys()] }, confidence: { gte: 0.8, lte: 1 }, technology: { kind: 'framework' } },
      select: { id: true, auditId: true, technologyId: true, confidence: true, detectedAt: true, detectorVersion: true,
        technology: { select: { name: true, kind: true } } },
      take: MAX_OBSERVATIONS + 1,
    }) : []
  if (technologies.length > MAX_OBSERVATIONS) return null
  const captures = new Map(audits.flatMap(audit => {
    if (!hasFrameworkCells || !audit.technologyDetectedAt || !audit.completedAt || !audit.technologyDetectorVersion ||
      (audit.technologyDetectionStatus !== 'COMPLETE' && audit.technologyDetectionStatus !== 'PARTIAL') ||
      audit.technologyDetectedAt < audit.createdAt || audit.technologyDetectedAt > audit.completedAt) return []
    const source = sourceEvidence.get(audit.id)
    const scope = captureObservationScopeSchema.safeParse(audit.technologyObservationScope)
    if (!source || !scope.success || scope.data.access !== 'public' ||
      !researchPublicTargetMatchesSite(source.siteUrl, scope.data.pageUrl) ||
      !researchPublicTargetMatchesSite(source.siteUrl, scope.data.finalUrl) ||
      new URL(scope.data.pageUrl).href !== new URL(audit.url).href) return []
    return [[audit.id, { scope: scope.data, version: audit.technologyDetectorVersion, detectedAt: audit.technologyDetectedAt }]] as const
  }))
  const frameworkFacts = new Set<string>()
  const countsMatch = dataset.issues.every((issue) => {
    const count = observations.get(issue.checkId)
    if (count?.sites.size !== issue.siteCount || count.flags.size !== issue.occurrenceCount ||
      countResearchGroups(count.audits, groups) < MIN_PUBLIC_RESEARCH_SITES) return false
    return issue.topFrameworks.every((framework) => {
      const sites = new Set<string>()
      const frameworkAudits = new Set<string>()
      for (const observation of technologies) {
        const capture = captures.get(observation.auditId)
        if (capture && count.audits.has(observation.auditId) && observation.technology.kind === 'framework' &&
          observation.technology.name === framework.name && Number.isFinite(observation.confidence) && observation.confidence >= 0.8 && observation.confidence <= 1 &&
          observation.detectorVersion === capture.version && observation.detectedAt.getTime() === capture.detectedAt.getTime()) {
          sites.add(sourceEvidence.get(observation.auditId)!.hostname)
          frameworkAudits.add(observation.auditId)
          frameworkFacts.add(JSON.stringify([issue.checkId, framework.name, observation.id, observation.auditId,
            observation.technologyId, observation.detectorVersion, observation.confidence, observation.detectedAt.toISOString(), capture.scope]))
          if (frameworkFacts.size > MAX_OBSERVATIONS) return false
        }
      }
      return sites.size === framework.siteCount && countResearchGroups(frameworkAudits, groups) >= MIN_PUBLIC_RESEARCH_SITES
    })
  })
  return countsMatch ? { observations, sourceEvidence, flags, frameworkFacts } : null
}

type ResearchIssueVersion = Pick<PublicIssueResearch['issues'][number], 'checkId' | 'checkVersion'>
type ManifestEvidence = NonNullable<Awaited<ReturnType<typeof readResearchManifestEvidence>>>

/** Compare every counted Flag and required coverage receipt at the same cutoff. */
export async function checkResearchIssueEvidence(issues: readonly ResearchIssueVersion[], observedBy: Date,
  { observations, sourceEvidence }: Pick<ManifestEvidence, 'observations' | 'sourceEvidence'>,
  db: Pick<Prisma.TransactionClient, '$queryRaw'>, includeReviewFingerprint: boolean) {
  const [versions, pageResponse] = await Promise.all([
    corroboratedResearchVersions(db, issues.flatMap(issue => [...(observations.get(issue.checkId)?.flags ?? [])]),
      observedBy, sourceEvidence, includeReviewFingerprint),
    issues.some(issue => PAGE_RESPONSE_RESEARCH_CHECKS.some(id => id === issue.checkId))
      ? readResearchPageResponseCoverage(db, sourceEvidence, observedBy, includeReviewFingerprint) : undefined,
  ])
  const versionedIssues = issues.filter(issue => {
    const flags = observations.get(issue.checkId)?.flags
    if (!flags?.size) return false
    return [...flags].every(flagId => {
      const proof = versions.get(flagId)
      return proof?.version === issue.checkVersion &&
        (!includeReviewFingerprint || Boolean(proof.observationSha256) && proof.receiptDigests.length > 0)
    })
  }).length
  return { versionedIssues, versions, pageResponse }
}

/** Compare only the counted Flags in the released cells, as of review. */
export async function reviewResearchReleaseEvidence(dataset: PublicIssueResearch,
  evidence: NonNullable<Awaited<ReturnType<typeof readResearchReleaseEvidence>>>, inputSha256: string,
  db: Pick<Prisma.TransactionClient, '$queryRaw'>) {
  const { sourceEvidence, flags, frameworkFacts } = evidence
  const { versionedIssues, versions, pageResponse } = await checkResearchIssueEvidence(
    dataset.issues, new Date(dataset.reviewedAt), evidence, db, true,
  )
  const pageResponseCoverage = pageResponse?.coverage
  if (versionedIssues !== dataset.issues.length || (pageResponse && pageResponse.coverage.status !== 'sample-covered')) {
    return { versionedIssues, evidenceSha256: null, pageResponseCoverage }
  }
  const sources = [...sourceEvidence].map(([auditId, source]) => JSON.stringify([auditId, source.hostname, source.ownerId,
    source.siteUrl, source.auditUrl, source.grantedAt, source.createdAt, source.completedAt])).sort()
  const findings = [...new Set(flags.flatMap(flag => {
    const proof = versions.get(flag.id)
    return proof ? [JSON.stringify([flag.id, flag.auditId, flag.checkId, flag.confidence, flag.createdAt,
      proof.version, proof.observationSha256, proof.receiptDigests])] : []
  }))].sort()
  const evidenceSha256 = createHash('sha256').update(JSON.stringify([
    'public-issue-evidence-v3', inputSha256, sources, findings, [...frameworkFacts].sort(),
    ...(pageResponse ? [['page-response-entry-coverage-v1', pageResponse.receiptDigests]] : []),
  ])).digest('hex')
  return { versionedIssues, evidenceSha256, pageResponseCoverage }
}
