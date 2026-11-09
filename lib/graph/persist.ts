import { currentExecutionOwnership, ExecutionOwnershipLost, executionTransaction, lockExecutionScope } from '@/lib/audit/execution-ownership'
import type { Prisma } from '@prisma/client'
import { includeLegacySiteAnalyses } from '@/lib/sites/application/analysis-scope'
/**
 * Knowledge-graph persistence layer.
 *
 * `persistAuditToGraph()` is called once per audit when it transitions to
 * COMPLETED. Replaying an audit can refresh its links without counting it
 * twice. Backfill scripts and the live hook both call it.
 *
 * The function upserts a graph:Site, the audit's graph:Pages, and the
 * graph:Issue rows for every flag. Crucially, **it does not** recompute the
 * aggregate counters (`occurrenceCount`, `siteCount`, `frameworkCount`) - those
 * are a rollup job run on schedule by scripts/growth/issue-frequencies.ts so
 * the per-flag persist can stay O(flags) and never block the audit path.
 *
 * See docs/growth/architecture.md for the data flow.
 */
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
  tx: Prisma.TransactionClient,
  auditId: string,
  snapshot: SiteSnapshot,
  linkedSiteId: string | null,
): Promise<{ siteId: string; pageIds: string[] }> {
  const hostname = hostnameOf(snapshot.rootUrl)
  if (!hostname) {
    throw new Error(
      `persistAuditToGraph: cannot derive hostname from rootUrl=${snapshot.rootUrl}`
    )
  }

  const site = await tx.site.upsert({
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
      ...(linkedSiteId === null ? { auditCount: { increment: 1 } } : {}),
      // Only overwrite a guess if we had none; never downgrade in-place.
      industryGuess:
        snapshot.industryGuess !== null ? snapshot.industryGuess : undefined,
    },
  })
  if (linkedSiteId && linkedSiteId !== site.id) throw new Error('The Audit already belongs to a different graph Site')

  const pageIds: string[] = []
  for (const url of snapshot.pageUrls) {
    const normPath = pathOf(url)
    const role =
      snapshot.pageRoles[url] ?? classifyPageRole(snapshot.pageUrls, url)

    const page = await tx.page.upsert({
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
  if (!linkedSiteId) await tx.audit.update({
    where: { id: auditId },
    data: { siteId: site.id },
  })

  // Link each AuditPage to its graph:Page by url match.
  const auditPages = await tx.auditPage.findMany({
    where: { auditId },
    select: { id: true, url: true, pageId: true },
  })
  const pageByUrl = new Map(snapshot.pageUrls.map((u, i) => [u, pageIds[i]]))
  for (const ap of auditPages) {
    const gid = pageByUrl.get(ap.url)
    if (gid && ap.pageId !== gid) {
      await tx.auditPage.update({
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
  tx: Prisma.TransactionClient,
  auditId: string,
  flag: FlagSnapshot,
  siteId: string
): Promise<string | null> {
  if (!flag.fingerprint || !flag.checkId) {
    // Flags without a fingerprint or checkId can't be aggregated. Skip silently -
    // the rollup script treats them as "untracked" and logs a count.
    return null
  }

  const fingerprint = flag.fingerprint
  const checkId = flag.checkId
  const issue = await tx.issue.upsert({
    where: { fingerprint },
    create: {
      fingerprint,
      checkId,
      rubric: flag.rubric,
      problemTemplate: flag.problem,
      fixTemplate: flag.fix,
    },
    update: {
      lastSeenAt: new Date(),
    },
  })

  // One occurrence per flag. unique on flagId guards idempotency.
  await tx.issueOccurrence.createMany({ data: { issueId: issue.id, siteId, flagId: flag.flagId }, skipDuplicates: true })

  // Link the Flag row to the Issue for read-model joins.
  await tx.flag.update({
    where: { id: flag.flagId, auditId },
    data: { issueId: issue.id },
  })

  return issue.id
}

/**
 * Upsert a FixPrompt for each (issue, tool) pair present on the flag.
 * Best-effort: missing prompts are simply skipped.
 */
async function upsertFixPrompts(
  tx: Prisma.TransactionClient,
  issueId: string,
  flag: FlagSnapshot
): Promise<void> {
  const candidates: Array<[string, string | null]> = [
    ['generic', flag.prompts.generic],
    ['cursor', flag.prompts.cursor],
    ['claude', flag.prompts.claude],
    ['lovable', flag.prompts.lovable],
    ['bolt', flag.prompts.bolt],
  ]

  for (const [tool, template] of candidates) {
    if (!template) continue
    await tx.fixPrompt.upsert({
      where: { issueId_tool: { issueId, tool } },
      create: { issueId, tool, template, usageCount: 1 },
      update: { template }, // refresh wording if upstream changed
    })
  }
}

/**
 * Upsert Technology and SiteTechnology rows for each detected tech.
 * This populates the graph tables used by Product intelligence and the
 * topFrameworks display on issue pages.
 */
async function lockSiteTechnologies(tx: Prisma.TransactionClient, siteId: string) {
  await tx.$queryRaw`SELECT "id" FROM "graph_site" WHERE "id" = ${siteId} FOR UPDATE`
}

export async function reconcileSiteTechnologies(
  siteId: string,
  detectedTech: SiteSnapshot['detectedTech'],
  reconcileCurrent: boolean,
  transaction?: Prisma.TransactionClient,
): Promise<void> {
  const persist = async (tx: Prisma.TransactionClient) => {
    if (reconcileCurrent) await tx.siteTechnology.updateMany({
      where: { siteId, isCurrent: true }, data: { isCurrent: false },
    })
    for (const tech of detectedTech.toSorted((a, b) => a.name.localeCompare(b.name))) {
      const technology = await tx.technology.upsert({
        where: { name: tech.name }, create: { name: tech.name, kind: tech.kind }, update: {},
      })
      await tx.siteTechnology.upsert({
        where: { siteId_technologyId: { siteId, technologyId: technology.id } },
        create: { siteId, technologyId: technology.id, confidence: tech.confidence, isCurrent: true },
        update: { lastSeenAt: new Date(), confidence: { set: tech.confidence }, isCurrent: true },
      })
    }
  }
  if (transaction) await persist(transaction)
  else await executionTransaction(async tx => { await lockSiteTechnologies(tx, siteId); await persist(tx) })
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
  flags: FlagSnapshot[]
): Promise<PersistResult> {
  const owner = currentExecutionOwnership()
  if (owner && owner.auditId !== auditId) throw new ExecutionOwnershipLost()
  return executionTransaction(async tx => {
    if (!owner && !await lockExecutionScope(tx, auditId)) throw new ExecutionOwnershipLost()
    const audit = await tx.audit.findUniqueOrThrow({ where: { id: auditId }, select: { siteId: true, status: true, url: true } })
    if (audit.status !== 'COMPLETED' || audit.url !== snapshot.rootUrl) throw new ExecutionOwnershipLost()
    const { siteId, pageIds } = await upsertSite(tx, auditId, snapshot, audit.siteId)

    if (snapshot.detectedTech.length > 0 || snapshot.technologyDetectionComplete) {
      // The Site upsert already holds the graph host lock through publication.
      const legacy = await tx.$queryRaw<Array<{ primaryAuditId: string }>>`
        SELECT DISTINCT p."primaryAuditId" FROM "provisional_sites" p
        JOIN "audits" a ON a."id" = p."primaryAuditId"
        WHERE a."siteId" = ${siteId} AND a."executionSpec"#>>'{scope}' IS NULL
      `
      const latest = await tx.audit.findFirst({
        where: { siteId, status: 'COMPLETED', AND: [includeLegacySiteAnalyses(legacy.map(site => site.primaryAuditId))] },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], select: { id: true },
      })
      if (latest?.id === auditId) await reconcileSiteTechnologies(siteId, snapshot.detectedTech, snapshot.technologyDetectionComplete, tx)
    }

    // Different hosts can share Issues. Acquire their rows in a stable order.
    const byFlag = new Map<string, string>()
    for (const flag of flags.toSorted((a, b) => (a.fingerprint ?? '').localeCompare(b.fingerprint ?? ''))) {
      const issueId = await upsertIssue(tx, auditId, flag, siteId)
      if (!issueId) continue
      byFlag.set(flag.flagId, issueId)
      await upsertFixPrompts(tx, issueId, flag)
    }
    const issueIds = flags.flatMap(flag => byFlag.get(flag.flagId) ?? [])
    return { siteId, pageIds, issueIds, occurrenceCount: issueIds.length }
  }, { timeout: 15_000 })
}
