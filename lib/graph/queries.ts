/**
 * Read models for the knowledge graph.
 *
 * These functions return only data shaped for the **public** surface - no
 * internal ids, no PII, no per-audit rows beyond what's needed to render a
 * page. Page templates (issue pages, benchmark pages, free tools) read from
 * here, never directly from Prisma.
 *
 * All queries respect `MIN_SAMPLE_SIZE` for any aggregate that would drive a
 * public page. A scope with sample < the threshold returns `null` and the
 * page 404s - that's the quality gate that prevents thin programmatic pages
 * from leaking into Google's index.
 *
 * See docs/growth/growth-architecture.md for the gates and thresholds.
 */
import { prisma } from '@/lib/db'
import { canSharePublicly } from '@/lib/auth/entitlements'
import {
  loadTechnologyProfile,
  type TechnologyProfile,
} from '@/lib/audit/technology-profile'

/**
 * Minimum distinct audited sites before publishing a programmatic growth page.
 *
 * Target long-term: 20 (AGENTS.md / knowledge). Currently **3** while the
 * growth graph seeds (issues spread thinly across check IDs). Revisit when
 * siteCount distribution supports restoring 20 without empty public pages.
 * Do not lower further. Customer Product Intelligence does not use this gate.
 */
export const MIN_SAMPLE_SIZE = 3

/**
 * Public read model for an issue page.
 */
export interface IssuePageData {
  checkId: string
  rubric: string
  problemTemplate: string
  fixTemplate: string
  /** Distinct audited sites where we've seen this issue. */
  siteCount: number
  /** Total observations across all sites (a single site may trigger many). */
  occurrenceCount: number
  /** Top frameworks where this issue appears, ranked by site share. */
  topFrameworks: Array<{ name: string; siteCount: number }>
  /** Top 3 redacted public examples - anonymized hostname + role only. */
  examples: Array<{ hostname: string; pageRole: string; severity: string }>
}

/**
 * Read a single issue by checkId. Returns null if the issue hasn't crossed
 * the minimum sample-size threshold - callers should 404.
 *
 * Aggregates are stored per-checkId (rollup writes the same counters onto
 * every fingerprint row for that check). We pick the freshest row for copy.
 */
export async function getIssuePage(checkId: string): Promise<IssuePageData | null> {
  const issue = await prisma.issue.findFirst({
    where: { checkId },
    orderBy: [{ siteCount: 'desc' }, { lastSeenAt: 'desc' }],
  })
  if (!issue) return null
  if (issue.siteCount < MIN_SAMPLE_SIZE) return null

  const topFrameworks = await prisma.$queryRaw<
    Array<{ name: string; site_count: bigint }>
  >`
    SELECT t.name AS name, COUNT(DISTINCT io."siteId")::bigint AS site_count
    FROM "graph_issue_occurrence" io
    JOIN "graph_issue" i ON i.id = io."issueId"
    JOIN "graph_site_technology" st ON st."siteId" = io."siteId"
    JOIN "graph_technology" t ON t.id = st."technologyId"
    WHERE i."checkId" = ${checkId}
      AND st."isCurrent" = true
    GROUP BY t.name
    ORDER BY site_count DESC
    LIMIT 5
  `

  const exampleRows = await prisma.$queryRaw<
    Array<{ hostname: string; pageRole: string; severity: string }>
  >`
    SELECT DISTINCT ON (s.hostname)
           s.hostname AS hostname,
           COALESCE(p.role, 'other') AS "pageRole",
           f.severity AS severity
    FROM "graph_issue_occurrence" io
    JOIN "graph_issue" i ON i.id = io."issueId"
    JOIN "graph_site" s ON s.id = io."siteId"
    JOIN "flags" f ON f.id = io."flagId"
    LEFT JOIN "graph_page" p ON p."siteId" = s.id AND p.url = f."pageUrl"
    WHERE i."checkId" = ${checkId}
    ORDER BY s.hostname, io."observedAt" DESC
    LIMIT 3
  `

  return {
    checkId,
    rubric: issue.rubric,
    problemTemplate: issue.problemTemplate,
    fixTemplate: issue.fixTemplate,
    siteCount: issue.siteCount,
    occurrenceCount: issue.occurrenceCount,
    topFrameworks: topFrameworks.map((r) => ({
      name: r.name,
      siteCount: Number(r.site_count),
    })),
    examples: exampleRows.map((r) => ({
      hostname: r.hostname.replace(/^www\./, ''),
      pageRole: r.pageRole,
      severity: r.severity,
    })),
  }
}

/**
 * Check IDs that have crossed MIN_SAMPLE_SIZE and may appear in the sitemap.
 * One row per checkId (denormalized counters are identical across fingerprints).
 */
export async function getIndexableIssueCheckIds(): Promise<
  Array<{ checkId: string; siteCount: number; lastSeenAt: Date }>
> {
  const rows = await prisma.$queryRaw<
    Array<{ checkId: string; siteCount: number; lastSeenAt: Date }>
  >`
    SELECT DISTINCT ON (i."checkId")
           i."checkId" AS "checkId",
           i."siteCount" AS "siteCount",
           i."lastSeenAt" AS "lastSeenAt"
    FROM "graph_issue" i
    WHERE i."siteCount" >= ${MIN_SAMPLE_SIZE}
    ORDER BY i."checkId", i."siteCount" DESC, i."lastSeenAt" DESC
  `
  return rows
}

/**
 * Public read model for a benchmark page.
 */
export interface BenchmarkData {
  scope: string
  sampleSize: number
  avgScore: number
  p25Score: number
  p50Score: number
  p75Score: number
  topIssues: Array<{ checkId: string; rate: number }>
  takenAt: Date
}

/**
 * Read the most recent benchmark snapshot for a scope. Returns null if there
 * is no snapshot or the sample size is below the public threshold.
 */
export async function getBenchmark(scope: string): Promise<BenchmarkData | null> {
  const snap = await prisma.benchmarkSnapshot.findFirst({
    where: { scope },
    orderBy: { takenAt: 'desc' },
  })
  if (!snap) return null
  if (snap.sampleSize < MIN_SAMPLE_SIZE) return null

  const topIssues = (snap.topIssues as Array<{ checkId: string; rate: number }>) ?? []

  return {
    scope,
    sampleSize: snap.sampleSize,
    avgScore: snap.avgScore,
    p25Score: snap.p25Score,
    p50Score: snap.p50Score,
    p75Score: snap.p75Score,
    topIssues,
    takenAt: snap.takenAt,
  }
}

/**
 * Recomputed top issues for a list of checkIds. Used by:
 * - the public marketing "top 3 issues" snapshot on /samples
 * - the homepage hero example finding list (in dry-run mode)
 *
 * Filter the result by `minOccurrence` to avoid previewing a near-empty issue.
 */
export async function getTopIssuesForChecks(
  checkIds: string[],
  minOccurrence = 0,
): Promise<
  Array<{ checkId: string; rubric: string; problemTemplate: string; siteCount: number }>
> {
  if (checkIds.length === 0) return []
  const issues = await prisma.issue.findMany({
    where: {
      checkId: { in: checkIds },
      siteCount: { gte: minOccurrence },
    },
    orderBy: { siteCount: 'desc' },
    take: 10,
    select: {
      checkId: true,
      rubric: true,
      problemTemplate: true,
      siteCount: true,
    },
  })
  return issues
}

/**
 * Internal-only: how many graph entities exist. Used by growth dashboards
 * and the weekly review script.
 */
export async function getGraphStats(): Promise<{
  sites: number
  pages: number
  issues: number
  occurrences: number
  benchmarks: number
}> {
  const [sites, pages, issues, occurrences, benchmarks] = await Promise.all([
    prisma.site.count(),
    prisma.page.count(),
    prisma.issue.count(),
    prisma.issueOccurrence.count(),
    prisma.benchmarkSnapshot.count(),
  ])
  return { sites, pages, issues, occurrences, benchmarks }
}

// ─── Madewith page ──────────────────────────────────────────────────────

/**
 * Public read model for a /madewith/[hostname] page.
 * Shows detected technologies, industry, and audit summary for a site.
 */
export interface MadewithPageData {
  hostname: string
  rootUrl: string
  industry: string | null
  technologyProfile: TechnologyProfile
  lastAudit: {
    id: string
    score: number | null
    flagCount: number
    completedAt: Date
    url: string
  }
  relatedSites: Array<{
    hostname: string
    techNames: string[]
  }>
}

/**
 * Read the tech stack and audit summary for a hostname.
 * Returns null if the hostname hasn't been audited yet.
 */
const PUBLIC_AUDIT_SELECT = {
  id: true,
  score: true,
  url: true,
  completedAt: true,
  user: {
    select: {
      id: true,
      role: true,
      plan: true,
      subscriptionStatus: true,
    },
  },
  rubrics: { select: { name: true, score: true } },
  flags: { select: { rubric: true, status: true } },
  _count: { select: { flags: true } },
} as const

async function eligiblePublicAuditForSite(siteId: string) {
  const candidates = await prisma.audit.findMany({
    where: {
      siteId,
      status: 'COMPLETED',
      isPublic: true,
      userId: { not: null },
      completedAt: { not: null },
      technologyObservations: { some: {} },
    },
    orderBy: { completedAt: 'desc' },
    take: 10,
    select: PUBLIC_AUDIT_SELECT,
  })
  return candidates.find((audit) => audit.user && canSharePublicly(audit.user)) ?? null
}

function normalizeMadewithHostname(hostname: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(hostname).replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
  if (
    decoded.length === 0 ||
    decoded.length > 253 ||
    decoded.includes('/') ||
    !/^[a-z0-9.-]+$/.test(decoded) ||
    !decoded.includes('.')
  ) {
    return null
  }
  return decoded
}

export async function getMadewithPage(hostname: string): Promise<MadewithPageData | null> {
  const normalizedHostname = normalizeMadewithHostname(hostname)
  if (!normalizedHostname) return null

  const site = await prisma.site.findUnique({
    where: { hostname: normalizedHostname },
    select: {
      id: true,
      hostname: true,
      rootUrl: true,
      industryGuess: true,
      technologies: {
        where: { isCurrent: true },
        select: {
          technologyId: true,
          technology: { select: { name: true } },
        },
      },
    },
  })
  if (!site) return null

  const audit = await eligiblePublicAuditForSite(site.id)
  if (!audit?.completedAt) return null

  const technologyProfile = await loadTechnologyProfile(audit.id, {
    score: audit.score,
    rubrics: audit.rubrics,
    flags: audit.flags,
  })
  if (technologyProfile.technologies.length === 0) return null

  const currentTechnologyIds = site.technologies.map((item) => item.technologyId)
  const relatedCandidates = currentTechnologyIds.length > 1
    ? await prisma.site.findMany({
        where: {
          id: { not: site.id },
          technologies: {
            some: {
              isCurrent: true,
              technologyId: { in: currentTechnologyIds },
            },
          },
        },
        take: 12,
        select: {
          id: true,
          hostname: true,
          technologies: {
            where: {
              isCurrent: true,
              technologyId: { in: currentTechnologyIds },
            },
            select: { technology: { select: { name: true } } },
          },
        },
      })
    : []

  const relatedSites: MadewithPageData['relatedSites'] = []
  for (const candidate of relatedCandidates) {
    if (candidate.technologies.length < 2) continue
    if (!(await eligiblePublicAuditForSite(candidate.id))) continue
    relatedSites.push({
      hostname: candidate.hostname,
      techNames: candidate.technologies.map((item) => item.technology.name).sort(),
    })
    if (relatedSites.length === 5) break
  }

  return {
    hostname: site.hostname,
    rootUrl: site.rootUrl,
    industry: site.industryGuess,
    technologyProfile,
    lastAudit: {
      id: audit.id,
      score: audit.score,
      flagCount: audit._count.flags,
      completedAt: audit.completedAt,
      url: audit.url,
    },
    relatedSites,
  }
}

export async function getIndexableMadewithProfiles(): Promise<
  Array<{ hostname: string; lastModified: Date }>
> {
  const sites = await prisma.site.findMany({
    where: {
      technologies: { some: { isCurrent: true } },
      audits: {
        some: {
          status: 'COMPLETED',
          isPublic: true,
          userId: { not: null },
          technologyObservations: { some: {} },
        },
      },
    },
    select: { id: true, hostname: true },
  })

  const result: Array<{ hostname: string; lastModified: Date }> = []
  for (const site of sites) {
    const audit = await eligiblePublicAuditForSite(site.id)
    if (audit?.completedAt) {
      result.push({ hostname: site.hostname, lastModified: audit.completedAt })
    }
  }
  return result
}
