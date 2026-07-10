/**
 * Audit-time helper: loads an audit's URL + flags from the database and
 * forwards them to `persistAuditToGraph()`. Lives here (not in lib/audit/)
 * so the audit pipeline doesn't have a hard import on graph internals beyond
 * this single function - which it calls fire-and-forget after finalization.
 *
 * See docs/growth/architecture.md for the full data flow.
 */
import { prisma } from '@/lib/db'
import { persistAuditToGraph } from '@/lib/graph/persist'
import type { FlagSnapshot } from '@/lib/graph/types'

/**
 * Persist a single just-completed audit into the knowledge graph.
 *
 * Reads:
 *  - audit.url           → Site.rootUrl
 *  - audit.pages[].url   → Page.url + role
 *  - audit.flags[]       → Issue + FixPrompt
 *
 * Determinism: identical input → identical graph state. The unique constraint
 * on graph_issue_occurrence.flagId makes the operation idempotent across
 * retries.
 */
export async function persistAuditGraphSnapshot(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      url: true,
      pages: { select: { url: true } },
      flags: {
        select: {
          id: true,
          checkId: true,
          rubric: true,
          fingerprint: true,
          problem: true,
          fix: true,
          pageUrl: true,
          agentPrompt: true,
          cursorPrompt: true,
          claudePrompt: true,
          lovablePrompt: true,
          boltPrompt: true,
        },
      },
    },
  })

  if (!audit) {
    // The audit was deleted between finalize and persist (rare). Nothing
    // useful to do; the rollup script will eventually GC dangling rows.
    return
  }

  const pageUrls = audit.pages.length > 0 ? audit.pages.map((p) => p.url) : [audit.url]

  const flags: FlagSnapshot[] = audit.flags.map((f) => ({
    flagId: f.id,
    checkId: f.checkId,
    rubric: f.rubric,
    fingerprint: f.fingerprint,
    problem: f.problem,
    fix: f.fix,
    pageUrl: f.pageUrl,
    prompts: {
      generic: f.agentPrompt,
      cursor: f.cursorPrompt,
      claude: f.claudePrompt,
      lovable: f.lovablePrompt,
      bolt: f.boltPrompt,
    },
  }))

  // Build page roles from existing roleOf heuristic in persist.ts
  const pageRoles: Record<string, string> = {}
  for (const url of pageUrls) {
    const p = new URL(url).pathname || '/'
    if (p === '/' || p === '') pageRoles[url] = 'home'
    else if (/pricing/i.test(p)) pageRoles[url] = 'pricing'
    else if (/sign[-_]?up|register/i.test(p)) pageRoles[url] = 'signup'
    else if (/sign[-_]?in|login/i.test(p)) pageRoles[url] = 'signin'
    else if (/blog|post|article|\/\d{4}\//i.test(p)) pageRoles[url] = 'blog'
    else pageRoles[url] = 'other'
  }

  await persistAuditToGraph(
    auditId,
    {
      rootUrl: audit.url,
      pageUrls,
      pageRoles,
      detectedTech: [],
      industryGuess: null,
    },
    flags,
  )
}
