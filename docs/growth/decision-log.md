# Decision log

Major decisions, recorded with alternatives considered and a review date.
Revisit when new evidence changes the calculus — don't silently drift away
from a recorded decision without logging the change.

Template:

```md
## [YYYY-MM-DD] Title

**Problem:**
**Alternatives considered:**
**Chosen solution:**
**Reasoning:**
**Confidence:** low / medium / high
**Expected outcome:**
**Review date:**
```

---

## [2026-07-09] Knowledge graph storage: Postgres vs. dedicated graph DB

**Problem:** The growth brief calls for an "internal knowledge graph"
modeling relationships between sites, pages, technologies, issues, fixes,
etc. Need to decide the storage layer.

**Alternatives considered:**
1. Dedicated graph database (Neo4j, Memgraph, FalkorDB) — purpose-built for
   traversal-heavy queries.
2. Postgres with explicit entity + join tables via Prisma (the existing
   stack).

**Chosen solution:** Postgres, via Prisma, using explicit relation tables
(`SiteTechnology`, `IssueOccurrence`, etc.) rather than a dedicated graph
store.

**Reasoning:** FixFlags already runs Postgres via Prisma for everything.
Adding a second database technology means a second connection pool, a
second migration story, a second thing to keep alive in production, and a
second thing for a solo developer to operate. The traversal patterns we
actually need (site → issues, issue → sites, issue → frameworks) are
2-3 hop joins — well within Postgres's comfort zone with the right indexes.
A dedicated graph store becomes worth the operational cost only if we hit
genuinely deep multi-hop traversals Postgres can't express efficiently,
which hasn't happened yet and may never happen at this data scale.

**Confidence:** high — this is a reversible decision (data can be exported
to a graph store later if needed) and the downside of over-engineering here
is much larger than the downside of under-engineering.

**Expected outcome:** Graph queries stay fast (<100ms) through at least
Phase 3 scale (tens of thousands of sites, low-hundreds of thousands of
occurrences). Revisit if query latency becomes a measured problem.

**Review date:** Revisit if `lib/graph/queries.ts` query latency becomes a
measured bottleneck, or after Phase 3 when data volume is much higher.

---

## [2026-07-09] Public launch sequencing: foundations-first, no Week-1 public pages

**Problem:** The mission brief's suggested pacing could be read as "ship one
issue page and one free tool in Week 1." Need to decide actual Week 1 scope.

**Alternatives considered:**
1. Ship one issue page + one free tool in Week 1 alongside the graph
   (aggressive, matches the brief's example sequencing).
2. Foundations only — graph, persistence, rollups, documentation. No public
   pages until the graph has been backfilled and observed.

**Chosen solution:** Option 2 — foundations only, explicitly directed by
the project owner (Saad) when asked: *"i want you to first lay the
foundations completely and log a plan in the codebase that we will work
with."*

**Reasoning:** Aligns with the brief's own philosophy — "do not optimize for
publishing more pages," and public pages should exist "because they provide
genuine value," which requires knowing what the graph actually contains.
Building `/issues/[checkId]` against assumed data risks having to rebuild it
once real distributions are visible.

**Confidence:** high — directly instructed, and independently justified by
the brief's stated principles.

**Expected outcome:** Phase 1 produces zero public-facing change and zero
SEO impact, but a fully wired graph that starts filling automatically from
the moment the migration is deployed. Phase 2 begins from real data instead
of assumptions.

**Review date:** At Phase 1 exit (see `roadmap.md`) — confirm the graph has
meaningful data before deciding what Phase 2's first shipped page actually
is.

---

## [OPEN] Analytics access (GSC / GA / PostHog / Bing / backlink tooling)

**Problem:** The growth system's prioritization (backlog ranking,
opportunity identification, weekly review) depends on real search and
funnel data. None of GSC, GA read access, PostHog, or a backlink tool has
been granted access as of this entry.

**Status:** Open — asked the project owner, no decision recorded yet.
Recommended minimum: GSC read-only access (highest signal-to-effort ratio
per the options discussed).

**Review date:** Before Phase 2 begins — this blocks real (vs. structural)
prioritization of the backlog.

---

## [2026-07-09] Production graph state audit — plan revised

**Problem:** Before continuing Phase 1 → Phase 2, verified actual production
state instead of trusting `roadmap.md`'s status table. Found three
discrepancies between documented status and reality:

1. The Phase 1 migration (`20260709211906_init`) existed only in the local
   working tree — never committed to git, never deployed to the production
   Railway Postgres. `graph_*` tables did not exist in production.
2. Production has **17 total audits, 1 registered user** (the project
   owner). This is pre-launch testing, not organic traffic. The 16 `FAILED`
   audits were from an earlier R2/screenshot misconfiguration that is now
   resolved — current health checks (`/api/health`, `/api/health/worker`,
   `/api/health/browser`) are all green.
3. `MIN_SAMPLE_SIZE = 20` distinct sites (per issue) was designed assuming
   organic audit volume would fill the graph. At 1 real user, waiting for
   organic signups alone to produce 20+ audited sites per check is not a
   weeks-long wait — it could be months to years pre-launch.

**Alternatives considered:**
1. Wait for organic volume to naturally cross `MIN_SAMPLE_SIZE` before any
   Phase 2 page ships, per the original foundations-first decision.
2. Self-seed the knowledge graph by deliberately running audits against a
   curated batch of real public sites (still real scan data — not
   fabricated statistics) to reach threshold quickly, decoupling "the graph
   has enough data" from "the product has organic users."

**Chosen solution:** Option 2 — self-seed. Real audits against real public
URLs (public SaaS landing pages, Product Hunt launches, indie-hacker
sites built with known AI builders) still produce genuine scan data;
this doesn't violate the "no fabricated statistics" rule in `AGENTS.md` /
`vision.md` because every data point traces to an actual Puppeteer-rendered
page. Standard bootstrap pattern for benchmark/comparison products before
network effects exist (comparable to how G2/Similarweb seed comparison
data pre-scale).

**Reasoning:** The mission brief explicitly says "challenge assumptions
continuously... never assume the current strategy is optimal." The
foundations-first sequencing was correct for Week 1, but it silently
assumed organic growth would eventually feed the graph — an assumption
that breaks down when there is effectively zero organic traffic yet. Not
correcting this means Phase 2 stays permanently blocked, which contradicts
the mission's operating loop (identify highest-leverage opportunity, act).

**Confidence:** medium — self-seeding produces real data, so the risk is
low, but it consumes engineering time (choosing target sites, running
audits, R2/storage cost) instead of purely reactive product growth work.
Revisit if organic signups accelerate before the graph reaches threshold
on its own.

**Expected outcome:** Within one seeding batch (~40-60 real public site
audits chosen to cluster around common AI-builder patterns — Lovable,
Bolt, v0, Cursor-generated landing pages), at least 2-3 checks should cross
`MIN_SAMPLE_SIZE = 20`, unblocking the first `/issues/[checkId]` page
without waiting on organic volume.

**Current status (2026-07-10):** The script now has all 4 phases:
1. Queue — create SEED audits and enqueue to BullMQ
2. Poll — wait for each audit to reach COMPLETED/FAILED
3. Rollup — recompute issue aggregates + rebuild examples
4. Report — count how many issues crossed `MIN_SAMPLE_SIZE`

The script is ready for execution but has not yet been run against
production — requires an active worker and database with audits.

**Review date:** After first seeding batch completes — check
`getGraphStats()` and re-rank `backlog.md` with real numbers.

---

## [2026-07-09] Four-layer architecture: measurement before public surfaces

**Problem:** The existing architecture had the knowledge graph and public
surface design, but lacked a measurement layer. Without attribution tracking,
we can't know which public pages drive conversions — meaning the core loop
(audit -> knowledge -> pages -> trust -> acquisition -> audit) has a
measurement break.

**Alternatives considered:**
1. Ship Phase 2 pages first, add attribution later (retrofit).
2. Design the attribution system now, require it on all Phase 2 pages
   from day one.

**Chosen solution:** Option 2 — design attribution now, implement before
Phase 2 pages ship.

**Reasoning:** Retrofitting attribution means either losing historical data
(catching up is impossible) or running dual tracking (complexity). By
requiring UTM parameters and extended `Audit.source` values on every Phase 2
page from day one, we get clean funnel data from the first page that earns
traffic. The cost is small (add UTM strings to link templates, extend an
enum) and the benefit is permanent.

**Confidence:** high — this is obviously correct in hindsight; the gap was
that the original architecture focused on the graph-to-page pipeline
without considering the page-to-measurement pipeline.

**Expected outcome:** Phase 2 pages ship with full attribution. Within 30
days of the first issue page earning impressions, we can answer: "Which
issue pages drive the most signups?" and "Which free tools have the highest
audit conversion rate?"

**Review date:** After first Phase 2 page ships — verify attribution is
working end-to-end.

---

## [2026-07-09] Internal linking engine: automatic topical authority

**Problem:** Public pages (issue pages, benchmark pages, tools) would exist
in isolation without cross-linking. Search engines reward topical authority
clusters — pages that link to related content on the same topic. Without an
engine, we'd need to manually maintain "related reading" sections.

**Alternatives considered:**
1. Manual "related" links per page (static, maintenance burden).
2. A `lib/graph/related.ts` module that queries the graph for related pages
   by rubric, framework, and check category.

**Chosen solution:** Option 2 — automated, graph-powered linking.

**Reasoning:** The knowledge graph already has the relationships needed:
`Issue.rubric` links issues by topic, `SiteTechnology` links issues by
framework, and `IssueOccurrence` links issues by co-occurrence on the same
sites. A function that queries these relationships and returns related
pages is cheap to build and zero-maintenance.

**Confidence:** high — the data relationships already exist in the schema;
this is a query layer, not a data modeling problem.

**Expected outcome:** Every public page automatically links to 3-5 related
pages, creating topical clusters. Internal link equity flows between related
pages, strengthening the entire cluster's ranking potential.

**Review date:** After first issue page ships — verify internal links are
rendering and click-through is measurable.

---

## [2026-07-09] Dynamic sitemap: knowledge-graph-driven indexing

**Problem:** The current sitemap is static — derived from `INDEXABLE_ROUTES`
in `seo-routes.ts`. Adding a new programmatic page family (e.g., issue
pages) requires manually adding routes to this registry. This is a manual
step that creates risk of pages existing but not being in the sitemap, or
being in the sitemap before they have sufficient content.

**Alternatives considered:**
1. Keep static sitemap, manually update when new families ship.
2. Generate sitemap from knowledge graph — only include pages backed by
   graph entities with sufficient sample size.

**Chosen solution:** Option 2 — dynamic sitemap from graph.

**Reasoning:** The MIN_SAMPLE_SIZE gate already ensures no thin page is
backed by a query. Extending this to the sitemap means: a page appears in
the sitemap if and only if it has a graph entity with sufficient sample.
This is the same quality gate, applied to indexing instead of rendering. It
prevents index bloat automatically.

**Confidence:** high — this is a direct extension of an existing quality
gate (MIN_SAMPLE_SIZE) to a new surface (sitemap).

**Expected outcome:** Issue pages automatically appear in the sitemap when
they cross MIN_SAMPLE_SIZE, and disappear if sample size drops below
threshold (e.g., due to data cleanup). No manual intervention needed.

**Review date:** After first dynamic sitemap generation — verify correct
routes are included and thin pages are excluded.
