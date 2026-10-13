import { z } from 'zod'
import { prisma } from '@/lib/db'
import { parseSiteHostname } from '@/lib/utils/url-helpers'
import { PUBLIC_RESEARCH_PATH, type PublicIssueResearch } from '@/lib/graph/public-research'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { RESEARCH_CONSENT_EVENT } from './research-consent-contract'
import { consentView, researchSiteIdentity, researchAuditMatchesSite } from './research-consent'

export const RESEARCH_PERMISSIONS_PATH = `${PUBLIC_RESEARCH_PATH}/permissions`
export const RESEARCH_PERMISSIONS_KIND = 'approved-private-research-permissions-v1'
const id = z.string().min(1).max(200)
export const researchPermissionsSchema = z.strictObject({
  version: z.literal(1),
  evidenceRef: z.string().min(1).max(4_000),
  sources: z.array(z.strictObject({ projectId: id, grantId: id, auditId: id })).min(1).max(5_000),
}).refine((value) => new Set(value.sources.map((source) => source.auditId)).size === value.sources.length)

/** Private source identities are checked here and never enter public research models. */
export async function hasCurrentResearchPermissions(dataset: PublicIssueResearch): Promise<boolean> {
  const artifact = await prisma.growthArtifact.findUnique({
    where: { path: RESEARCH_PERMISSIONS_PATH }, select: { kind: true, payload: true },
  })
  if (artifact?.kind !== RESEARCH_PERMISSIONS_KIND) return false
  const parsed = researchPermissionsSchema.safeParse(artifact.payload)
  if (!parsed.success || parsed.data.evidenceRef !== dataset.evidenceRef) return false
  const sources = parsed.data.sources
  const projectIds = [...new Set(sources.map((source) => source.projectId))]
  const [projects, grants, audits] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: projectIds }, deletedAt: null }, select: { id: true, userId: true, url: true } }),
    prisma.siteLifecycleEvent.findMany({
      where: { projectId: { in: projectIds }, name: RESEARCH_CONSENT_EVENT },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], distinct: ['projectId'],
      select: { id: true, projectId: true, userId: true, version: true, properties: true, createdAt: true },
    }),
    prisma.audit.findMany({
      where: { id: { in: sources.map((source) => source.auditId) } },
      select: { id: true, projectId: true, userId: true, url: true, status: true, createdAt: true, completedAt: true },
    }),
  ])
  const owners = new Map(projects.map((project) => [project.id, project]))
  const currentGrants = new Map(grants.map((grant) => [grant.projectId, grant]))
  const sourceAudits = new Map(audits.map((audit) => [audit.id, audit]))
  const hostnames = new Set<string>()
  const hostnameByAudit = new Map<string, string>()
  for (const source of sources) {
    const project = owners.get(source.projectId)
    const grant = currentGrants.get(source.projectId)
    const audit = sourceAudits.get(source.auditId)
    if (!project || !researchAuditMatchesSite(project.url, project.url) || !grant || grant.id !== source.grantId || !consentView(grant, project.userId, researchSiteIdentity(project.url)).enabled ||
      !audit || audit.projectId !== source.projectId || audit.userId !== project.userId || audit.status !== 'COMPLETED' ||
      !audit.completedAt || audit.completedAt < audit.createdAt || audit.createdAt < grant.createdAt ||
      audit.createdAt < new Date(dataset.windowStart) || audit.completedAt > new Date(dataset.windowEnd)) return false
    const hostname = parseSiteHostname(audit.url).toLowerCase()
    if (!hostname || !researchAuditMatchesSite(project.url, audit.url)) return false
    hostnames.add(hostname)
    hostnameByAudit.set(audit.id, hostname)
  }
  if (hostnames.size !== dataset.sampleSiteCount) return false
  // Connected search context cannot be repurposed under this browser-evidence grant.
  if (dataset.issues.some((issue) => CHECK_REGISTRY[issue.checkId]?.module === 'search')) return false
  const flags = await prisma.flag.findMany({
    where: { auditId: { in: sources.map((source) => source.auditId) }, source: 'DETERMINISTIC', confidence: { gte: 0.8, lte: 1 }, createdAt: { lte: new Date(dataset.reviewedAt) } },
    select: { id: true, auditId: true, checkId: true, source: true, confidence: true, createdAt: true },
  })
  const observations = new Map<string, { flags: Set<string>; sites: Set<string>; audits: Set<string> }>()
  for (const flag of flags) {
    const audit = sourceAudits.get(flag.auditId)
    if (flag.source !== 'DETERMINISTIC' || !Number.isFinite(flag.confidence) || flag.confidence < 0.8 || flag.confidence > 1 ||
      !audit || flag.createdAt < audit.createdAt || flag.createdAt > new Date(dataset.reviewedAt)) continue
    const hostname = hostnameByAudit.get(flag.auditId)
    const checkId = flag.checkId?.split('::page:')[0]
    if (!hostname || !checkId || !CHECK_REGISTRY[checkId]) continue
    const count = observations.get(checkId) ?? { flags: new Set<string>(), sites: new Set<string>(), audits: new Set<string>() }
    count.flags.add(flag.id); count.sites.add(hostname); count.audits.add(flag.auditId); observations.set(checkId, count)
  }
  const technologies = dataset.issues.some((issue) => issue.topFrameworks.length > 0)
    ? await prisma.auditTechnologyObservation.findMany({
      where: { auditId: { in: sources.map((source) => source.auditId) }, confidence: { gte: 0.8, lte: 1 }, technology: { kind: 'framework' } },
      select: { auditId: true, confidence: true, detectedAt: true, detectorVersion: true, technology: { select: { name: true, kind: true } } },
    }) : []
  return dataset.issues.every((issue) => {
    const count = observations.get(issue.checkId)
    if (count?.sites.size !== issue.siteCount || count.flags.size !== issue.occurrenceCount) return false
    return issue.topFrameworks.every((framework) => {
      const sites = new Set<string>()
      for (const observation of technologies) {
        const audit = sourceAudits.get(observation.auditId)
        if (audit && count.audits.has(audit.id) && observation.technology.kind === 'framework' &&
          observation.technology.name === framework.name && Number.isFinite(observation.confidence) && observation.confidence >= 0.8 && observation.confidence <= 1 && observation.detectorVersion &&
          observation.detectedAt >= audit.createdAt && observation.detectedAt <= new Date(dataset.reviewedAt)) {
          sites.add(hostnameByAudit.get(audit.id)!)
        }
      }
      return sites.size === framework.siteCount
    })
  })
}
