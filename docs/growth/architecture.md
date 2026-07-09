# Architecture

Status: **Foundations implemented (Week 1). No public surfaces shipped yet.**

This document is the living design for FixFlags' organic growth system. It
covers the knowledge graph, the public knowledge layer derived from it, and
the automation that keeps both growing. See `roadmap.md` for what's actually
built vs. planned at any given time — this file describes the target
architecture, not a snapshot of progress.

## The core idea

```
Audit (input URL)
   ↓
Extract entities (frameworks, builders, industry, region, page role)
   ↓
Emit Flags (Check × Evidence × Fix)
   ↓
Write to knowledge graph (Sites, Pages, Issues, Fixes, Occurrences)
   ↓
Re-derive public artifacts on schedule (rollup jobs, revalidation)
   ↓
Public artifacts index (programmatic pages, benchmarks, free tools)
   ↓
Discovery (search / AI crawlers / social) → visitor → signup → audit
   ↓ (back to top)
```

Every cycle should strengthen the next. The knowledge graph is the thing that
compounds — public pages are just its export layer.

## 1. Internal knowledge graph (private)

**Decision:** stay in Postgres via Prisma. A separate graph database
(Neo4j, Memgraph) is unnecessary at current scale — Postgres with explicit
join tables handles the traversals we need. Revisit only if aggregate
queries become a genuine bottleneck.

### Entities (implemented in `prisma/schema.prisma`, `graph_*` tables)

| Model | Purpose |
|---|---|
| `Site` | One row per audited hostname. Tracks audit count, industry guess, detected tech. |
| `Page` | One row per distinct URL path seen during any audit of a site. Has a role (home, pricing, signup, etc). |
| `Technology` | Framework / builder / hosting / CMS / analytics vocabulary. |
| `SiteTechnology` | Join table: which technologies a site uses, with confidence. |
| `Industry` | Industry taxonomy (saas, ecommerce, agency, ...). |
| `Issue` | One row per **fingerprint** — the same underlying problem across many sites. Holds denormalized counters (`occurrenceCount`, `siteCount`, `frameworkCount`) recomputed by the rollup job. |
| `IssueOccurrence` | One row per flag that matched an issue — the raw event log the counters are derived from. Unique on `flagId`, which is what makes graph persistence idempotent. |
| `FixPrompt` | Per-(issue, tool) canonical fix prompt (cursor/claude/lovable/bolt/generic), with usage + success-rate tracking. |
| `BenchmarkSnapshot` | Point-in-time aggregate stats for a scope (e.g. `"builder:lovable"`, `"industry:saas"`). |
| `Experiment` | Hypothesis → outcome log for growth experiments. |
| `ToolUsage` | Anonymous usage events from free tools (once built) — the top-of-funnel signal. |
| `GrowthArtifact` | Lineage record: which file/report was generated from which data, and when. |

### Existing tables extended (not replacing anything)

- `Audit.siteId` (nullable FK → `Site`) — every audit is linked to the site it audited.
- `AuditPage.pageId` (nullable FK → `Page`) — every audit page is linked to the graph's canonical page.
- `Flag.issueId` (nullable FK → `Issue`) — every flag is linked to the issue it represents.

All three are **nullable** so the migration is non-destructive for existing
rows. `scripts/graph/backfill-historical.ts` fills them in for historical
audits; new audits get them automatically via the finalize hook.

### Write path

`lib/graph/persist.ts` exports `persistAuditToGraph(auditId, snapshot, flags)`.

- **Idempotent.** Calling it twice on the same audit does not create duplicate
  occurrences (`graph_issue_occurrence.flagId` is unique) and does not
  double-count `Site.auditCount` incorrectly on a clean re-run (upsert semantics).
- **Fire-and-forget from the audit pipeline.** `lib/graph/snapshot.ts` exports
  `persistAuditGraphSnapshot(auditId)`, called from `finalizeAudit()` in
  `lib/audit/finalize.ts` immediately after the audit is marked `COMPLETED`.
  Wrapped in `.catch()` — a graph failure must never block a user's audit
  from completing.
- **Cheap on the hot path.** The persist function does NOT recompute
  aggregate counters (`occurrenceCount`, `siteCount`, `frameworkCount`) —
  that's deliberately deferred to a scheduled rollup so the per-audit write
  stays O(flags) and never adds latency to report delivery.

### Rollup path

`scripts/growth/issue-frequencies.ts` recomputes `Issue.occurrenceCount`,
`Issue.siteCount`, `Issue.frameworkCount`, and `Issue.examples` from the raw
`IssueOccurrence` log. Runs nightly (once wired into the self-hosted
scheduler in `lib/queue/`, see `roadmap.md` Phase 2). Idempotent — safe to
run any number of times.

### Backfill

`scripts/graph/backfill-historical.ts` is a one-shot script that walks every
`COMPLETED` audit and calls `persistAuditToGraph()`. Run once after the
migration lands, then the live hook takes over. Supports `--limit N` for a
smoke test and `--dry-run` for a no-write pass.

## 2. Public knowledge layer (derived, indexable)

**Not built yet — Week 2+.** Design captured here so implementation follows
one plan.

Read models live in `lib/graph/queries.ts`. Public pages call these functions
— **never** query `graph_*` tables directly from a page component. This is
the boundary that keeps the graph private while the derived data is public.

### Six page families

| Family | Route pattern | Information gain |
|---|---|---|
| Site Report | `/report/[auditId]` (public opt-in) | Full audit, screenshots, evidence anchors |
| Reports Index | `/reports`, `/reports/[industry]`, `/reports/[framework]` | Filterable recency index |
| Benchmark | `/benchmarks/[scope]` | Rolling `BenchmarkSnapshot` — score distribution, sample size |
| Issue Library | `/issues/[checkId]` | Frequency, top frameworks, anonymized examples, canonical fix prompt |
| Comparison | `/compare/[slug]` | Cross-source scoring on the same audited URL |
| Free Tool | `/tools/[slug]` | Instant self-serve result + audit CTA |

### The quality gate: `MIN_SAMPLE_SIZE`

Defined in `lib/graph/queries.ts` as `20`. Any read model backing a
public page returns `null` if the underlying sample (distinct sites) is
below this threshold. The page template must 404 on `null`, not render a
thin page. This is the single most important guardrail against index bloat
and is **not negotiable** — see `vision.md` non-goals.

Revisit this number after 90 days of real data — it's a starting point, not
a law.

### Information gain rule (per template, not per family)

Every page template must render at least one number or artifact that only
FixFlags can produce:
- Issue page → frequency + real (anonymized) examples + our fix prompt
- Benchmark page → our own sample's score distribution
- Report page → our screenshots + our evidence anchors

If a template can't satisfy this, it doesn't ship. No exceptions for
"it'll rank anyway."

## 3. Free tools

Not built yet. Priority order (see `roadmap.md`):

1. `/tools/meta-preview` — paste URL → instant OG card preview
2. `/tools/cta-above-fold` — paste URL → CTA visibility check at 375px
3. `/tools/placeholder-copy-detector` — paste snippet → slop-rule linter

Each writes an anonymous `ToolUsage` row (`inputHash`, never raw input) so we
can measure tool → audit conversion without touching PII.

## 4. Automation & measurement

Not built yet beyond the rollup script. Planned:

- `scripts/growth/pull-gsc.ts` — GSC API → `docs/growth/metrics/gsc-*.json`
- `scripts/growth/rollup-benchmarks.ts` — fresh `BenchmarkSnapshot` per scope
- `scripts/growth/opportunity-scoring.ts` → ranks pages by impressions × CTR
  gap, writes `opportunities.md`
- `scripts/growth/weekly-review.ts` → composes `weekly-review/YYYY-Www.md`

All scheduled via the existing self-hosted scheduler
(`lib/queue/recovery-scheduler.ts` pattern), Redis-lock guarded, consistent
with how FixFlags already runs its stuck-audit recovery and nurture email
jobs. No external cron needed.

## 5. Boundaries and invariants (do not violate)

1. **The knowledge graph is never exposed directly.** Public pages read
   derived, denormalized data via `lib/graph/queries.ts`.
2. **No PII in public artifacts.** Examples show hostname + page role +
   severity only. No user data, no audit owner, no email.
3. **Minimum sample size gates every aggregate claim.** No exceptions.
4. **Graph writes never block the audit pipeline.** Always fire-and-forget
   with `.catch()`.
5. **Aggregate counters are always derived, never hand-edited.** If a number
   looks wrong, fix the rollup script, not the row.
6. **Every public page traces to a query in `lib/graph/queries.ts`.** If you
   can't point to the query, the page shouldn't claim the number.

## Open questions (tracked, not blocking)

See `decision-log.md` for anything that needs an explicit decision, and
`opportunities.md` once analytics access exists. Current open items:
- GSC / GA / PostHog access — not yet granted (see `decision-log.md`)
- Industry/tech detection heuristics — currently stubbed to `null`/`[]` in
  `lib/graph/snapshot.ts`; needs real detection logic before benchmark pages
  can be built (Phase 2/3 dependency)
- Backlink tooling choice — unresolved
