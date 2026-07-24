# Architecture

*Last updated: 2026-07-10*

Status: **Growth system active. GSC/GA4 data pulling. Knowledge graph seeding in progress.**

This document is the living design for FixFlags' organic growth system. It
covers the knowledge graph, the public knowledge layer derived from it, and
the automation that keeps both growing. See `growth-roadmap.md` for what's actually
built vs. planned at any given time — this file describes the target
architecture, not a snapshot of progress.

## The core loop

```
Product generates knowledge
  → Knowledge generates public assets
    → Assets generate trust
      → Trust generates organic acquisition
        → Acquisition generates more audits
          → Audits generate more knowledge (back to top)
```

Every cycle should strengthen the next. The knowledge graph is the thing that
compounds — public pages are just its export layer.

## Four-layer architecture

The system has four layers, each feeding the next:

```
┌─────────────────────────────────────────────────────┐
│ Layer 4: MEASUREMENT & FEEDBACK                     │
│ Attribution · Experiments · Weekly reviews · Learning│
├─────────────────────────────────────────────────────┤
│ Layer 3: PUBLIC SURFACES                            │
│ Issue pages · Benchmarks · Tools · Reports · Compare│
├─────────────────────────────────────────────────────┤
│ Layer 2: INTELLIGENCE                               │
│ Rollups · Opportunity scoring · Competitive analysis│
├─────────────────────────────────────────────────────┤
│ Layer 1: DATA COLLECTION                            │
│ Audit pipeline · GSC · Analytics · Backlinks · SERP │
└─────────────────────────────────────────────────────┘
```

**Layer 1 → Layer 2:** Raw data becomes aggregated insight.
**Layer 2 → Layer 3:** Insight becomes public pages with information gain.
**Layer 3 → Layer 4:** Pages generate traffic, which generates measurable outcomes.
**Layer 4 → Layer 1:** Learning improves what data we collect and how.

## Layer 1: Data collection (automated, continuous)

The foundation. Every data source feeds the knowledge graph or the
measurement layer.

### 1a. Audit pipeline (IMPLEMENTED)

The primary data source. Every completed audit writes to the knowledge graph
via `persistAuditToGraph()` — fire-and-forget, idempotent, O(flags).

**What it captures per audit:**
- Site (hostname, root URL)
- Pages (URLs, roles)
- Flags (checkId, rubric, severity, fingerprint, problem, fix, evidence)
- Fix prompts (cursor, claude, lovable, bolt, generic)
- Screenshots (desktop, mobile)
- Performance data (PageSpeed metrics)
- HTML metadata (title, description, OG tags, etc.)
- Flow data (CTA click-through results)
- Technology detection (framework, builder, CMS/commerce, hosting, analytics/monitoring, payments, support)
- Industry classification (SaaS, E-commerce, Agency, etc.)

**Tech detection:** Runs during the capture phase via `lib/audit/tech-detect.ts`.
It inspects rendered HTML, a bounded sanitized resource inventory, allowlisted
document headers, and known runtime markers from the existing Playwright
navigation. Results are normalized into audit-owned observations, then the
latest complete snapshot reconciles `graph_technology` /
`graph_site_technology`. Explicitly public, currently eligible audits feed
`/madewith/[hostname]`; current site technology rows feed `topFrameworks`.

### 1b. Search Console (NOT IMPLEMENTED — blocked on access)

**Purpose:** Measure which queries drive impressions, clicks, and signups.

**Required data pulls:**
- `searchAnalytics` — queries, pages, impressions, clicks, CTR, position
- `urlInspection` — index coverage, crawl status
- `sitemaps` — submitted vs. indexed counts

**Script:** `scripts/growth/pull-gsc.ts`
**Output:** `docs/growth/metrics/gsc-rolling-30d.json` + feeds `opportunities.md`
**Schedule:** Daily (once access is granted)

**Why it matters:** Without GSC data, every prioritization decision in
`backlog.md` is structural reasoning, not measured demand. This is the single
highest-leverage unlock for Layer 2.

### 1c. Analytics (client funnel shipped; organic attribution blocked)

**Purpose:** Track the conversion funnel: organic visit → audit → signup → paid.

**Client funnel events (shipped via `lib/analytics/events.ts` + admin page):**
- Full launch funnel including `landing_view`, `audit_intent`, `started_audit`, `signup_started` (email + OAuth), `fix_prompt_copied`, `recheck_*`
- See `.cursor/skills/fixflags-analytics/SKILL.md`

**Missing:** Organic attribution rollup (GSC/GA access). Currently no way to trace which public page
(or search query) led to which audit. See Layer 4 for the attribution design.

### 1d. Competitive intelligence (NOT IMPLEMENTED)

**Purpose:** Track who ranks for target queries, their moats, our wedges.

**Data sources:**
- SERP monitoring (manual initially, automated later)
- Backlink analysis (Moz free tier or Ahrefs API)
- Community monitoring (Reddit, HN, X for AI-builder discussions)

**Output:** `docs/growth/competitors.md` (populated, not scaffolded)

## Layer 2: Intelligence (automated, scheduled)

Raw data becomes aggregated insight. This layer runs on schedule and produces
the inputs that Layer 3's public pages consume.

### 2a. Issue frequency rollup (IMPLEMENTED)

`scripts/growth/issue-frequencies.ts` — recomputes `Issue.occurrenceCount`,
`Issue.siteCount`, `Issue.frameworkCount`, and `Issue.examples` from the raw
`IssueOccurrence` log. Runs every 6 hours via the self-hosted scheduler.

### 2b. Benchmark snapshots (NOT IMPLEMENTED)

**Purpose:** Point-in-time aggregate stats per scope (e.g. `"builder:lovable"`,
`"industry:saas"`, `"framework:nextjs"`).

**Script:** `scripts/growth/rollup-benchmarks.ts`
**Output:** `BenchmarkSnapshot` rows in the knowledge graph
**Schedule:** Weekly

**What it computes per scope:**
- Sample size (distinct sites)
- Score distribution (avg, p25, p50, p75)
- Top issues by frequency
- Trend vs. previous snapshot

**Dependency:** Requires industry/tech detection in Layer 1a to populate
`SiteTechnology` and `Industry` tables — without those, no scope exists to
snapshot.

### 2c. Opportunity scoring (NOT IMPLEMENTED)

**Purpose:** Rank growth opportunities by measured demand × conversion potential.

**Script:** `scripts/growth/opportunity-scoring.ts`
**Output:** Updated `backlog.md` rankings + `opportunities.md` with real data
**Schedule:** Weekly

**Scoring formula (v1):**
```
score = (impressions × CTR_gap × position_weight) + (sample_size_bonus × conversion_potential)
```

Where:
- `impressions` = GSC 30-day rolling impressions for the query cluster
- `CTR_gap` = expected CTR for position minus actual CTR (higher = more room)
- `position_weight` = 1.0 for position 5-20 (close to page 1), 0.5 for 21-50
- `sample_size_bonus` = 1.0 if graph has ≥ MIN_SAMPLE_SIZE for the topic, 0.0 otherwise
- `conversion_potential` = estimated commercial intent (manual v1, data-driven v2)

### 2d. Competitive analysis (NOT IMPLEMENTED)

**Purpose:** Identify content gaps, backlink opportunities, and positioning
advantages.

**Output:** Updated `competitors.md` with real SERP data
**Schedule:** Monthly

### 2e. Automated weekly review (NOT IMPLEMENTED)

**Purpose:** Compose `weekly-review/YYYY-Www.md` from live data instead of
manual entry.

**Script:** `scripts/growth/weekly-review.ts`
**Output:** Weekly review file + updated `metrics.md`
**Schedule:** Weekly (Sunday evening)

**What it pulls:**
- GSC rolling 7d vs. prior 7d (impressions, clicks, position)
- Graph stats (sites, pages, issues, occurrences)
- New backlinks (if tracked)
- Conversion funnel numbers (if analytics access exists)
- Experiment status updates

## Knowledge graph (private, underpins Layers 1-2)

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
scheduler in `lib/queue/`, see `growth-roadmap.md` Phase 2). Idempotent — safe to
run any number of times.

### Backfill

`scripts/graph/backfill-historical.ts` is a one-shot script that walks every
`COMPLETED` audit and calls `persistAuditToGraph()`. Run once after the
migration lands, then the live hook takes over. Supports `--limit N` for a
smoke test and `--dry-run` for a no-write pass.

## Layer 3: Public surfaces (derived, indexable)

**Not built yet — Phase 2+.** Design captured here so implementation follows
one plan.

Read models live in `lib/graph/queries.ts`. Public pages call these functions
— **never** query `graph_*` tables directly from a page component. This is
the boundary that keeps the graph private while the derived data is public.

### Six page families

| Family | Route pattern | Information gain | Blocked by |
|---|---|---|---|
| Site Report | `/report/[auditId]` (public opt-in) | Full audit, screenshots, evidence anchors | Nothing — already works |
| Reports Index | `/reports`, `/reports/[industry]`, `/reports/[framework]` | Filterable recency index | Enough `isPublic` audits |
| Benchmark | `/benchmarks/[scope]` | Rolling `BenchmarkSnapshot` — score distribution, sample size | Industry/tech detection + sample size |
| Issue Library | `/issues/[checkId]` | Frequency, top frameworks, anonymized examples, canonical fix prompt | Sample size (MIN_SAMPLE_SIZE) |
| Comparison | `/compare/[slug]` | Cross-source scoring on the same audited URL | Multiple audits of same URL |
| Free Tool | `/tools/[slug]` | Instant self-serve result + audit CTA | Nothing for meta-preview and placeholder-detector |

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
- Free tool → instant result from our pipeline (not a static page)

If a template can't satisfy this, it doesn't ship. No exceptions for
"it'll rank anyway."

### Internal linking engine (NOT IMPLEMENTED)

**Purpose:** Build topical authority clusters by linking related public pages.

**Design:** A function `getRelatedPages(pageType, pageId)` that returns
related pages based on:

| From | To | Linking signal |
|---|---|---|
| Issue page | Other issues in same rubric | `Issue.rubric` |
| Issue page | Benchmark for dominant framework | `IssueOccurrence` → `SiteTechnology` |
| Benchmark page | Top issues for that scope | `BenchmarkSnapshot.topIssues` |
| Benchmark page | Other benchmarks (same industry or framework) | Shared scope prefix |
| Free tool | Related issue pages | Tool detects same check IDs |
| Free tool | Audit CTA | Always — every tool page ends with "Run a full audit" |

**Implementation:** A `lib/graph/related.ts` module that queries the graph
and returns an array of `{ type, slug, title, reason }` for the page
template to render as "Related reading" or "See also" sections.

### Dynamic sitemap (NOT IMPLEMENTED — replaces static sitemap)

**Purpose:** As issues cross `MIN_SAMPLE_SIZE`, they automatically appear in
the sitemap without manual intervention.

**Design:** `app/sitemap.ts` reads from the knowledge graph:
- Static routes (from `INDEXABLE_ROUTES`) — unchanged
- Issue routes: `Issue.findMany({ where: { siteCount: { gte: MIN_SAMPLE_SIZE } } })`
- Benchmark routes: `BenchmarkSnapshot.findMany(...)` with dedup by scope
- Tool routes: hardcoded (small, stable set)

**Quality gate:** Only routes backed by a graph entity with sufficient sample
appear in the sitemap. This prevents thin pages from being indexed.

### Structured data expansion (NOT IMPLEMENTED)

Current: Organization, WebSite, SoftwareApplication, FAQPage.

Add per page family:

| Page type | Schema.org type | Key properties |
|---|---|---|
| Issue page | `Article` + `Dataset` | `about` (the check), `mentions` (frameworks), `distribution` (frequency) |
| Benchmark page | `Dataset` + `Report` | `variableMeasured` (score, sample size), `measurementMethod` (FixFlags audit) |
| Free tool | `SoftwareApplication` + `WebAPI` | `input` (URL), `output` (result), `provider` (FixFlags) |
| Comparison page | `Article` + `Review` | `itemReviewed`, `reviewRating` |

**Why this matters:** Google uses structured data for rich results, featured
snippets, and AI Overviews. `Dataset` schema is particularly powerful for
research-backed pages — it signals "this page contains original data."

## Layer 4: Measurement & feedback

The layer that makes the system self-improving. Every iteration should
produce measurable learning that feeds back into Layer 1 and Layer 2.

### Attribution system (NOT IMPLEMENTED)

**Problem:** We can't trace which public page (or search query) led to which
audit, signup, or payment.

**Design:** Two mechanisms:

**1. UTM parameters on all public surface links:**
```
/issues/[checkId]?utm_source=issue&utm_medium=organic&utm_campaign=[checkId]
/tools/meta-preview?utm_source=tool&utm_medium=organic&utm_campaign=meta-preview
/benchmarks/[scope]?utm_source=benchmark&utm_medium=organic&utm_campaign=[scope]
```

**2. Audit source tracking:**
The `Audit.source` enum already exists (`HOMEPAGE`, `DASHBOARD`, `REPORT`,
`API`, `MCP`, `UNKNOWN`). Extend it with:
- `ISSUE_PAGE` — audit started from an issue page
- `BENCHMARK_PAGE` — audit started from a benchmark page
- `TOOL_PAGE` — audit started from a free tool
- `REPORT_INDEX` — audit started from the reports index

This traces the full funnel: `source page → audit → signup → payment`.

### Experiment framework (PARTIALLY IMPLEMENTED)

The `Experiment` table exists in the schema. What's missing:

**1. Consistent experiment logging:**
Every experiment must log to `experiments.md` with:
- Hypothesis (before implementation)
- Success metric (single number)
- Baseline (before change)
- Result (after change, after sufficient time)
- Decision (kept / reverted / inconclusive)

**2. A/B testing infrastructure:**
For public pages, use URL parameter-based variants:
```
/issues/[checkId]?variant=b (B variant of the page)
```
Track which variant each visitor sees via `ToolUsage` or a lightweight
`PageVariant` table.

**3. Content performance scoring:**
For each public page, compute a weekly performance score:
```
performance = (impressions × CTR × position_score × conversion_rate)
```
This replaces subjective "is this page good?" with a single number that
can be tracked over time.

### Feedback loops (NOT IMPLEMENTED)

The system should automatically:

1. **Detect declining pages** — if a page's impressions or CTR drops for
   3+ consecutive weeks, flag it in the weekly review for content refresh.

2. **Detect rising queries** — if GSC shows new queries driving impressions
   to existing pages, check if a dedicated page would serve them better.

3. **Detect graph gaps** — if a check ID has high search volume but no
   issue page (below MIN_SAMPLE_SIZE), prioritize self-seeding for that
   check's topic.

4. **Detect competitive moves** — if a competitor launches a similar page,
   note it in `competitors.md` and evaluate whether our data advantage
   justifies a response.

## Boundaries and invariants (do not violate)

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
7. **Every public statistic must have a data lineage.** `GrowthArtifact`
   tracks which file was generated from which data and when.
8. **Attribution parameters are mandatory on all public surface links.** No
   page should link to the audit flow without UTM/source tracking.

## Data flow diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        AUDIT PIPELINE                        │
│                                                              │
│  URL → Playwright → Screenshots → Checks → AI Review → Flags │
│                                                    ↓         │
│                                           persistAuditToGraph│
│                                                    ↓         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE GRAPH (private)                 │
│                                                              │
│  Sites ← Pages ← Issues ← Occurrences ← FixPrompts         │
│    ↓         ↓         ↓                                      │
│  Technologies  Benchmarks  Experiments                        │
│    ↓                                                        │
│  Industries                                                  │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   ROLLUP / INTELLIGENCE                      │
│                                                              │
│  issue-frequencies.ts (6h) → Issue counters                  │
│  rollup-benchmarks.ts (weekly) → BenchmarkSnapshot           │
│  opportunity-scoring.ts (weekly) → backlog.md ranking        │
│  weekly-review.ts (weekly) → weekly-review/ + metrics.md     │
│  pull-gsc.ts (daily) → opportunities.md + metrics.md        │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   PUBLIC SURFACES (indexable)                 │
│                                                              │
│  /issues/[checkId]  ← Issue frequency + examples + fix      │
│  /benchmarks/[scope] ← Score distribution + top issues      │
│  /tools/meta-preview ← Instant OG preview + audit CTA       │
│  /tools/placeholder-copy-detector ← Slop linter + audit CTA │
│  /reports  ← Opt-in public reports index                     │
│  /compare/[slug]  ← Cross-source comparison                  │
│                                                              │
│  + Dynamic sitemap + Structured data + Internal links        │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                  DISCOVERY → CONVERSION                      │
│                                                              │
│  Search / AI crawlers / Social → Visitor → Tool result       │
│    → Audit CTA → Audit → Signup → Paid                       │
│    ↓                                                         │
│  Attribution (UTM + source) → Measurement                    │
│    → Learning → Back to Layer 1                               │
└──────────────────────────────────────────────────────────────┘
```

## Open questions (tracked, not blocking)

See `decision-log.md` for anything that needs an explicit decision, and
`opportunities.md` once analytics access exists. Current open items:
- GSC / GA / PostHog access — not yet granted (see `decision-log.md`)
- Industry/tech detection heuristics — currently stubbed to `null`/`[]` in
  `lib/graph/snapshot.ts`; needs real detection logic before benchmark pages
  can be built (Phase 2/3 dependency)
- Backlink tooling choice — unresolved
- Attribution system design — needs implementation before conversion tracking
  is meaningful
