# Roadmap

Phase-based, not date-based. We move to the next phase when the current
phase's exit criteria are met — not on a calendar.

## Phase 1 — Foundations (current)

**Goal:** the knowledge graph exists, fills automatically, and nothing
public has shipped yet. No marketing claims until there's real data behind
them.

### Deliverables

| Deliverable | Status |
|---|---|
| Prisma migration: 10 graph tables + FK links on `Audit`/`AuditPage`/`Flag` | ✅ Done |
| `lib/graph/persist.ts` — idempotent write path | ✅ Done |
| `lib/graph/queries.ts` — public read models with `MIN_SAMPLE_SIZE` gate | ✅ Done |
| `lib/graph/snapshot.ts` — audit → graph adapter | ✅ Done |
| Live hook in `finalizeAudit()` — every new audit persists automatically | ✅ Done |
| `scripts/graph/backfill-historical.ts` — one-shot historical backfill | ✅ Done |
| `scripts/growth/issue-frequencies.ts` — nightly rollup script | ✅ Done |
| `docs/growth/` workspace seeded | ✅ Done |
| Committed to git + pushed to `origin/main` | ✅ Done 2026-07-09 |
| Migration applied to production DB | ✅ Done 2026-07-09 |
| Backfill run against production | ✅ Done 2026-07-09 |
| Rollup wired into self-hosted scheduler | ✅ Done 2026-07-09 |
| Analytics access (GSC/GA/PostHog) | ⬜ Still awaiting decision |
| Self-seed knowledge graph | ✅ Done — 4-phase script queues, polls, rolls up, and reports readiness |
| Industry/tech detection in snapshot.ts | ✅ Done — already implemented, verified connected end-to-end |

### Exit criteria for Phase 1

- ~~Migration applied in production, backfill run, getGraphStats() returns non-zero.~~ ✅
- ~~Rollup script running nightly without manual intervention.~~ ✅
- **Self-seed script complete:** 4-phase script (queue → poll → rollup →
  report) ships. Requires running against 60 curated public URLs.
  Produces genuine scan data for the graph.
- **Industry/tech detection verified** in `lib/graph/snapshot.ts` → `persist.ts`
  pipeline (reads `AuditPage.performanceData.detectedTech` + `industryGuess`,
  writes `SiteTechnology`, `Industry`, `Site.industryGuess`). Already
  implemented — just needs real audit data to populate.

## Phase 2 — First public artifacts (not started)

**Goal:** ship the *smallest possible* real thing per family, gated by
MIN_SAMPLE_SIZE, and measure before scaling.

### Deliverables

| Deliverable | Blocked by | Priority |
|---|---|---|
| `/tools/meta-preview` — first free tool | ✅ Done | P0 |
| `/tools/placeholder-copy-detector` — second free tool | ✅ Done | P0 |
| `/issues/[checkId]` — first issue page | Sample size | P0 |
| Attribution parameter system | ✅ Done — `ISSUE_PAGE`, `BENCHMARK_PAGE`, `TOOL_PAGE` added | P1 |
| Extend `INDEXABLE_ROUTES` + `sitemap.ts` + `llms.txt` | ✅ Done — tools registered, issues/benchmarks ready for templates | P1 |
| `seo-guard.mjs` assertions for new route registries | ✅ Done | P1 |
| Internal linking engine (`lib/graph/related.ts`) | Issue page template | P2 |
| Structured data for issue pages | Issue page template | P2 |
| Basic analytics wiring | GSC access | P2 |

### Exit criteria for Phase 2

- One issue page live, indexed, receiving impressions in GSC (if access
  granted) or at minimum verified crawlable via `curl` + robots checks.
- Two free tools live (`/tools/meta-preview`, `/tools/placeholder-detector`),
  `ToolUsage` rows accumulating.
- Attribution parameters on all public surface links (`AuditSource` enum
  extended with `TOOL_PAGE` / `ISSUE_PAGE` / `BENCHMARK_PAGE`).
- A full weekly-review cycle completed at least once.

## Phase 3 — Scale the families (not started)

**Goal:** expand what worked in Phase 2, add benchmark pages, build the
measurement layer.

### Deliverables

| Deliverable | Blocked by |
|---|---|
| Expand `/issues/[checkId]` to all checks crossing sample threshold | Sample size |
| `/benchmarks/[scope]` — first benchmark pages | Tech detection + sample size |
| `/reports` public index (opt-in reports only) | Enough `isPublic` audits + PII redaction audit |
| Third free tool: `/tools/cta-above-fold` | Audit pipeline reuse |
| `scripts/growth/rollup-benchmarks.ts` | Tech detection |
| `scripts/growth/opportunity-scoring.ts` | GSC access |
| `scripts/growth/weekly-review.ts` | GSC access + analytics |
| Sitemap split (static, issues, benchmarks, tools) | All page families |
| Structured data for benchmark pages | Benchmark template |
| Dynamic sitemap from knowledge graph | All page families |
| Experiment framework (A/B testing infrastructure) | Traffic volume |

### Exit criteria for Phase 3

- At least 5 issue pages live and indexed.
- At least 1 benchmark page live with real data.
- Weekly review automated and running.
- Opportunity scoring feeding backlog re-ranking from real data.

## Phase 4 — Original research & comparisons (not started)

**Goal:** establish FixFlags as the authoritative source for AI-built product
QA research.

### Deliverables

| Deliverable | Blocked by |
|---|---|
| `/compare/[slug]` — comparison pages | Multiple audits of same URL |
| First original-research piece backed by graph data | Sufficient graph data |
| Backlink program (tooling TBD) | Link-worthy assets from Phase 2-3 |
| Competitive intelligence automation | SERP monitoring tools |

### Research topics (candidates)

- "We audited N Lovable-built landing pages — here's what breaks"
- "The top 5 issues in AI-built SaaS landing pages (2026 data)"
- "How AI-built sites perform vs. hand-built: a data comparison"
- "The state of AI-built product QA: a FixFlags report"

### Exit criteria for Phase 4

- At least 1 comparison page live.
- At least 1 original research piece published.
- Backlink program generating measurable referring domain growth.

## Explicitly deferred

- Programmatic pSEO at the "thousands of pages" scale — only after Phase 3
  proves the page families convert and hold up in the index. See
  `vision.md` non-goals: index bloat is a real risk, not a hypothetical one.
- Community features (Discord, forums)
- Paid acquisition — different owner, different system
