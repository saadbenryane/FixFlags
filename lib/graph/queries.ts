/** Public research reads approved aggregates, never customer graph records. */
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { hasCurrentResearchPermissions } from '@/lib/growth/research-permissions'
import {
  MIN_PUBLIC_RESEARCH_SITES,
  PUBLIC_RESEARCH_KIND,
  PUBLIC_RESEARCH_PATH,
  parsePublicIssueResearch,
} from './public-research'

export const MIN_SAMPLE_SIZE = MIN_PUBLIC_RESEARCH_SITES

export interface IssuePageData {
  checkId: string
  rubric: string
  problemTemplate: string
  fixTemplate: string
  siteCount: number
  occurrenceCount: number
  topFrameworks: Array<{ name: string; siteCount: number }>
  /** Identifiable examples require a separate permission contract. */
  examples: Array<{ hostname: string; pageRole: string; severity: string }>
  research: {
    windowStart: string
    windowEnd: string
    reviewedAt: string
    sampleSiteCount: number
    methodology: string
    limitations: string[]
  }
}

// Metadata, the page, and related links share this snapshot within a render.
export const getPublicIssueLibrary = cache(async (): Promise<IssuePageData[]> => {
  const dataset = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const artifact = await tx.growthArtifact.findUnique({
      where: { path: PUBLIC_RESEARCH_PATH },
      select: { kind: true, payload: true },
    })
    if (artifact?.kind !== PUBLIC_RESEARCH_KIND) return null
    const release = parsePublicIssueResearch(artifact.payload)
    return release && await hasCurrentResearchPermissions(release, tx) ? release : null
  }, { isolationLevel: 'RepeatableRead' }).catch(() => null)
  if (!dataset) return []
  return dataset.issues.map((issue) => ({
    checkId: issue.checkId,
    rubric: issue.rubric,
    problemTemplate: issue.problemTemplate,
    fixTemplate: issue.fixTemplate,
    siteCount: issue.siteCount,
    occurrenceCount: issue.occurrenceCount,
    topFrameworks: issue.topFrameworks,
    examples: [],
    research: {
      windowStart: dataset.windowStart,
      windowEnd: dataset.windowEnd,
      reviewedAt: dataset.reviewedAt,
      sampleSiteCount: dataset.sampleSiteCount,
      methodology: dataset.methodology,
      limitations: dataset.limitations,
    },
  })).sort((a, b) => b.siteCount - a.siteCount || a.checkId.localeCompare(b.checkId))
})

export async function getIssuePage(checkId: string): Promise<IssuePageData | null> {
  return (await getPublicIssueLibrary()).find((issue) => issue.checkId === checkId) ?? null
}

/** Sitemap and index use the same reviewed release as the detail page. */
export async function getIndexableIssueCheckIds(): Promise<
  Array<{ checkId: string; siteCount: number; reviewedAt: Date }>
> {
  return (await getPublicIssueLibrary()).map((issue) => ({
    checkId: issue.checkId,
    siteCount: issue.siteCount,
    reviewedAt: new Date(issue.research.reviewedAt),
  }))
}

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

/** Legacy benchmark rows have no permitted-use provenance. No public release yet. */
export async function getBenchmark(_scope: string): Promise<BenchmarkData | null> {
  void _scope
  return null
}

export async function getTopIssuesForChecks(
  checkIds: string[],
  minOccurrence = 0,
): Promise<Array<{ checkId: string; rubric: string; problemTemplate: string; siteCount: number }>> {
  if (checkIds.length === 0) return []
  return (await getPublicIssueLibrary())
    .filter((issue) => checkIds.includes(issue.checkId) && issue.siteCount >= minOccurrence)
    .slice(0, 10)
    .map(({ checkId, rubric, problemTemplate, siteCount }) => ({ checkId, rubric, problemTemplate, siteCount }))
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
