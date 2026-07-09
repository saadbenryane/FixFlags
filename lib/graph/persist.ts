/**
 * Knowledge-graph persistence layer.
 *
 * `persistAuditToGraph()` is called once per audit when it transitions to
 * COMPLETED. It is **idempotent** — running it twice on the same audit produces
 * the same graph state. Backfill scripts and the live hook both call it.
 *
 * The function upserts a graph:Site, the audit's graph:Pages, and the
 * graph:Issue rows for every flag. Crucially, **it does not** recompute the
 * aggregate counters (`occurrenceCount`, `siteCount`, `frameworkCount`) — those
 * are a rollup job run on schedule by scripts/growth/issue-frequencies.ts so
 * the per-flag persist can stay O(flags) and never block the audit path.
 *
 * See docs/growth/architecture.md for the data flow.
 */
import { prisma } from '@/lib/db'
import type { SiteSnapshot, FlagSnapshot, PersistResult } from './types'

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return '/'
  }
}

function roleOf(pageUrls: string[], url: string): string {
  // Cheap heuristic — refine when we have a real classifier. The graph tolerates
  // noisy roles; the public surface filters on role being meaningful.
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
      techGuess: snapshot.detectedTech.length
        ? (snapshot.detectedTech as unknown as object)
        : undefined,
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
    const role = snapshot.pageRoles[url] ?? roleOf(snapshot.pageUrls, url)

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

  // Link the audit row to the site. Nullable per schema — existing audits
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
    // Flags without a fingerprint or checkId can't be aggregated. Skip silently —
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
