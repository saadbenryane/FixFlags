/**
 * Knowledge-graph persistence layer.
 *
 * `persistAuditToGraph()` is called once per audit when it transitions to
 * COMPLETED. It is **idempotent** - running it twice on the same audit produces
 * the same graph state. Backfill scripts and the live hook both call it.
 *
 * The function upserts a graph:Site, the audit's graph:Pages, and the
 * graph:Issue rows for every flag. Crucially, **it does not** recompute the
 * aggregate counters (`occurrenceCount`, `siteCount`, `frameworkCount`) - those
 * are a rollup job run on schedule by scripts/growth/issue-frequencies.ts so
 * the per-flag persist can stay O(flags) and never block the audit path.
 *
 * See docs/growth/architecture.md for the data flow.
 */
import { prisma } from '@/lib/db'
import type { SiteSnapshot, FlagSnapshot, PersistResult } from './types'
import { parseSiteHostname } from '@/lib/utils/url-helpers'

function hostnameOf(url: string): string {
  return parseSiteHostname(url).toLowerCase()
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return '/'
  }
}

/**
 * Classify a page URL into a semantic role for the knowledge graph.
 * Used by persist.ts, snapshot.ts, and backfill-historical.ts.
 */
export function classifyPageRole(pageUrls: string[], url: string): string {
  if (pageUrls.length === 1) return 'home'
  const p = pathOf(url)
  if (p === '/' || p === '') return 'home'
  if (/pricing/i.test(p)) return 'pricing'
  if (/sign[-_]?up|register/i.test(p)) return 'signup'
  if (/sign[-_]?in|login/i.test(p)) return 'signin'
  if (/blog|post|article|\/\d{4}\//i.test(p)) return 'blog'
  if (/about/i.test(p)) return 'about'
  if (/contact/i.test(p)) return 'contact'
  if (/docs?|docs\//i.test(p)) return 'docs'
  return 'other'
}

/**
 * Upsert the Site row + all known Pages for an audit. Returns the site id
 * and the page ids in visit order matching `snapshot.pageUrls`.
 */
async function upsertSite(
  auditId: string,
  snapshot: SiteSnapshot,
): Promise<{ siteId: string; pageIds: string[] }> {
  const hostname = hostnameOf(snapshot.rootUrl)
  if (!hostname) {
    throw new Error(
      `persistAuditToGraph: cannot derive hostname from rootUrl=${snapshot.rootUrl}`,
    )
  }

  const site = await prisma.site.upsert({
    where: { hostname },
    create: {
      hostname,
      rootUrl: snapshot.rootUrl,
      industryGuess: snapshot.industryGuess,
      auditCount: 1,
      lastAuditedAt: new Date(),
    },
    update: {
      lastAuditedAt: new Date(),
      auditCount: { increment: 1 },
      // Only overwrite a guess if we had none; never downgrade in-place.
      industryGuess:
        snapshot.industryGuess !== null ? snapshot.industryGuess : undefined,
    },
  })

  const pageIds: string[] = []
  for (const url of snapshot.pageUrls) {
    const normPath = pathOf(url)
    const role = snapshot.pageRoles[url] ?? classifyPageRole(snapshot.pageUrls, url)

    const page = await prisma.page.upsert({
      where: {
        siteId_url: { siteId: site.id, url },
      },
      create: {
        siteId: site.id,
        url,
        path: normPath,
        role,
        lastSeenAt: new Date(),
      },
      update: {
        lastSeenAt: new Date(),
        role,
      },
    })
    pageIds.push(page.id)
  }

  // Link the audit row to the site. Nullable per schema - existing audits
  // before this migration get filled by the backfill script.
  await prisma.audit.update({
    where: { id: auditId },
    data: { siteId: site.id },
  })

  // Link each AuditPage to its graph:Page by url match.
  const auditPages = await prisma.auditPage.findMany({
    where: { auditId },
    select: { id: true, url: true },
  })
  const pageByUrl = new Map(snapshot.pageUrls.map((u, i) => [u, pageIds[i]]))
  for (const ap of auditPages) {
    const gid = pageByUrl.get(ap.url)
    if (gid && (await prisma.auditPage.findUnique({ where: { id: ap.id } }))?.pageId !== gid) {
      await prisma.auditPage.update({
        where: { id: ap.id },
        data: { pageId: gid },
      })
    }
  }

  return { siteId: site.id, pageIds }
}

/**
 * Upsert an Issue row for a single flag and record its occurrence against the
 * given site. Returns the issue id.
 */
async function upsertIssue(
  flag: FlagSnapshot,
  siteId: string,
): Promise<string | null> {
  if (!flag.fingerprint || !flag.checkId) {
    // Flags without a fingerprint or checkId can't be aggregated. Skip silently -
    // the rollup script treats them as "untracked" and logs a count.
    return null
  }

  const issue = await prisma.issue.upsert({
    where: { fingerprint: flag.fingerprint },
    create: {
      fingerprint: flag.fingerprint,
      checkId: flag.checkId,
      rubric: flag.rubric,
      problemTemplate: flag.problem,
      fixTemplate: flag.fix,
    },
    update: {
      lastSeenAt: new Date(),
    },
  })

  // One occurrence per flag. unique on flagId guards idempotency.
  try {
    await prisma.issueOccurrence.create({
      data: {
        issueId: issue.id,
        siteId,
        flagId: flag.flagId,
      },
    })
  } catch (err: unknown) {
    // P2002 = unique violation on flagId: this flag already had an occurrence
    // recorded. That's the expected outcome on a re-run.
    const code = (err as { code?: string }).code
    if (code !== 'P2002') throw err
  }

  // Link the Flag row to the Issue for read-model joins.
  await prisma.flag.update({
    where: { id: flag.flagId },
    data: { issueId: issue.id },
  })

  return issue.id
}

/**
 * Upsert a FixPrompt for each (issue, tool) pair present on the flag.
 * Best-effort: missing prompts are simply skipped.
 */
async function upsertFixPrompts(issueId: string, flag: FlagSnapshot): Promise<void> {
  const candidates: Array<[string, string | null]> = [
    ['generic', flag.prompts.generic],
    ['cursor', flag.prompts.cursor],
    ['claude', flag.prompts.claude],
    ['lovable', flag.prompts.lovable],
    ['bolt', flag.prompts.bolt],
  ]

  for (const [tool, template] of candidates) {
    if (!template) continue
    await prisma.fixPrompt.upsert({
      where: { issueId_tool: { issueId, tool } },
      create: { issueId, tool, template, usageCount: 1 },
      update: { template }, // refresh wording if upstream changed
    })
  }
}

/**
 * Upsert Technology and SiteTechnology rows for each detected tech.
 * This populates the graph tables that feed /madewith pages and
 * the topFrameworks display on issue pages.
 */
export async function reconcileSiteTechnologies(
  siteId: string,
  detectedTech: SiteSnapshot['detectedTech'],
  reconcileCurrent: boolean,
): Promise<void> {
  if (reconcileCurrent) {
    await prisma.siteTechnology.updateMany({
      where: { siteId, isCurrent: true },
      data: { isCurrent: false },
    })
  }

  for (const tech of detectedTech) {
    const technology = await prisma.technology.upsert({
      where: { name: tech.name },
      create: { name: tech.name, kind: tech.kind },
      update: {}, // name is unique, kind is fixed per tech
    })

    // Upsert the site-technology link with confidence.
    // Use upsert with P2002 catch for concurrent-audit safety.
    try {
      await prisma.siteTechnology.upsert({
        where: { siteId_technologyId: { siteId, technologyId: technology.id } },
        create: {
          siteId,
          technologyId: technology.id,
          confidence: tech.confidence,
          isCurrent: true,
        },
        update: {
          lastSeenAt: new Date(),
          confidence: { set: tech.confidence },
          isCurrent: true,
        },
      })
    } catch (err: unknown) {
      // P2002 = race condition: another audit created the row between our check and write.
      const code = (err as { code?: string }).code
      if (code !== 'P2002') throw err
    }
  }
}

/**
 * Public entry point. Persist everything an audit just learned into the
 * knowledge graph. Safe to call repeatedly; safe to call on already-persisted
 * audits (will re-upsert but not duplicate occurrences thanks to the unique
 * guard on IssueOccurrence.flagId).
 */
export async function persistAuditToGraph(
  auditId: string,
  snapshot: SiteSnapshot,
  flags: FlagSnapshot[],
): Promise<PersistResult> {
  const { siteId, pageIds } = await upsertSite(auditId, snapshot)

  // Upsert technology detections into the graph tables
  const latestCompletedAudit = await prisma.audit.findFirst({
    where: { siteId, status: 'COMPLETED' },
    orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  })
  const ownsCurrentSnapshot = latestCompletedAudit?.id === auditId

  if (
    ownsCurrentSnapshot &&
    (snapshot.detectedTech.length > 0 || snapshot.technologyDetectionComplete)
  ) {
    await reconcileSiteTechnologies(
      siteId,
      snapshot.detectedTech,
      snapshot.technologyDetectionComplete
    )
  }

  const issueIds: string[] = []
  for (const flag of flags) {
    const issueId = await upsertIssue(flag, siteId)
    if (!issueId) continue
    issueIds.push(issueId)
    await upsertFixPrompts(issueId, flag)
  }

  return {
    siteId,
    pageIds,
    issueIds,
    occurrenceCount: issueIds.length,
  }
}
