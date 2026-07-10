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
 * See docs/growth/architecture.md for the gates and thresholds.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

/**
 * The minimum number of distinct audited sites we need to be comfortable
 * publishing a programmatic page about a given issue or benchmark scope.
 * 20 is a defensible starting point - high enough to be representative, low
 * enough that we won't starve new axes. Revisit in 90 days with real data.
 */
export const MIN_SAMPLE_SIZE = 20

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
 */
export async function getIssuePage(checkId: string): Promise<IssuePageData | null> {
  const issue = await prisma.issue.findFirst({
    where: { checkId },
  })
  if (!issue) return null
  if (issue.siteCount < MIN_SAMPLE_SIZE) return null

  // Top frameworks: count distinct sites per technology via IssueOccurrence
  // joined to SiteTechnology. The DISTINCT is what makes this meaningful.
  const topFrameworks = await prisma.$queryRaw<
    Array<{ name: string; site_count: bigint }>
  >`
    SELECT t.name AS name, COUNT(DISTINCT io.site_id)::bigint AS site_count
    FROM "graph_issue_occurrence" io
    JOIN "graph_issue" i ON i.id = io."issueId"
    JOIN "graph_site_technology" st ON st."siteId" = io."siteId"
    JOIN "graph_technology" t ON t.id = st."technologyId"
    WHERE i."checkId" = ${checkId}
    GROUP BY t.name
    ORDER BY site_count DESC
    LIMIT 5
  `

  // Anonymized examples - never expose user-identifying data.
  const exampleRows = await prisma.$queryRaw<
    Array<{ hostname: string; pageRole: string; severity: string }>
  >`
    SELECT s.hostname AS hostname,
           COALESCE(p.role, 'other') AS "pageRole",
           f.severity AS severity
    FROM "graph_issue_occurrence" io
    JOIN "graph_issue" i ON i.id = io."issueId"
    JOIN "graph_site" s ON s.id = io."siteId"
    JOIN "flags" f ON f.id = io."flagId"
    LEFT JOIN "graph_page" p ON p.site_id = s.id AND p.url = f."pageUrl"
    WHERE i."checkId" = ${checkId}
    ORDER BY io."observedAt" DESC
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
  techStack: Array<{ name: string; kind: string }>
  lastAudit: {
    score: number | null
    flagCount: number
    completedAt: Date
    url: string
  } | null
  relatedSites: Array<{
    hostname: string
    techNames: string[]
  }>
}

/**
 * Read the tech stack and audit summary for a hostname.
 * Returns null if the hostname hasn't been audited yet.
 */
export async function getMadewithPage(hostname: string): Promise<MadewithPageData | null> {
  const normalizedHostname = hostname.replace(/^www\./, '').toLowerCase()

  const site = await prisma.site.findUnique({
    where: { hostname: normalizedHostname },
    select: {
      hostname: true,
      rootUrl: true,
      industryGuess: true,
      technologies: {
        select: {
          technology: {
            select: { name: true, kind: true },
          },
          confidence: true,
        },
        orderBy: { confidence: 'desc' },
      },
      audits: {
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 1,
        select: {
          score: true,
          url: true,
          completedAt: true,
          _count: { select: { flags: true } },
        },
      },
    },
  })

  if (!site) return null

  const techStack = site.technologies
    .filter((st) => st.confidence >= 0.7)
    .map((st) => ({ name: st.technology.name, kind: st.technology.kind }))

  const lastAudit = site.audits[0]?.completedAt
    ? {
        score: site.audits[0].score,
        flagCount: site.audits[0]._count.flags,
        completedAt: site.audits[0].completedAt,
        url: site.audits[0].url,
      }
    : null

  // Find related sites: sites that share at least 2 technologies
  const sharedTechNames = techStack.map((t) => t.name)
  const relatedSites = sharedTechNames.length > 0
    ? await prisma.$queryRaw<
        Array<{ hostname: string; tech_names: string[] }>
      >`
        SELECT s.hostname,
               array_agg(DISTINCT t.name) AS tech_names
        FROM "graph_site" s
        JOIN "graph_site_technology" st ON st."siteId" = s.id
        JOIN "graph_technology" t ON t.id = st."technologyId"
        WHERE t.name IN (${Prisma.join(sharedTechNames)})
          AND s.hostname != ${normalizedHostname}
        GROUP BY s.hostname
        HAVING count(DISTINCT t.name) >= 2
        ORDER BY count(DISTINCT t.name) DESC
        LIMIT 5
      `
    : []

  return {
    hostname: site.hostname,
    rootUrl: site.rootUrl,
    industry: site.industryGuess,
    techStack,
    lastAudit,
    relatedSites: relatedSites.map((r) => ({
      hostname: r.hostname,
      techNames: r.tech_names,
    })),
  }
}
