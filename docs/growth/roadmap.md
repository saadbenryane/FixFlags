# Roadmap

Phase-based, not date-based. We move to the next phase when the current
phase's exit criteria are met — not on a calendar.

## Phase 1 — Foundations (current)

**Goal:** the knowledge graph exists, fills automatically, and nothing
public has shipped yet. No marketing claims until there's real data behind
them.

| Deliverable | Status |
|---|---|
| Prisma migration: 10 graph tables + FK links on `Audit`/`AuditPage`/`Flag` | ✅ Done |
| `lib/graph/persist.ts` — idempotent write path | ✅ Done |
| `lib/graph/queries.ts` — public read models with `MIN_SAMPLE_SIZE` gate | ✅ Done |
| `lib/graph/snapshot.ts` — audit → graph adapter | ✅ Done |
| Live hook in `finalizeAudit()` — every new audit persists automatically | ✅ Done |
| `scripts/graph/backfill-historical.ts` — one-shot historical backfill | ✅ Done |
| `scripts/growth/issue-frequencies.ts` — nightly rollup script | ✅ Done |
| `docs/growth/` workspace seeded | ✅ Done (this file) |
| Committed to git + pushed to `origin/main` | ✅ Done 2026-07-09 (was sitting uncommitted locally) |
| Migration applied to production DB | ✅ Done 2026-07-09 (`npm run db:deploy` against Railway Postgres) |
| Backfill run against production | ✅ Done 2026-07-09 — 1 completed audit backfilled (production has only 1 real completed audit; see decision-log 2026-07-09) |
| Rollup wired into self-hosted scheduler | ✅ Done 2026-07-09 (`lib/queue/recovery-scheduler.ts`, Redis-lock guarded, runs alongside recovery/nurture ticks) |
| Analytics access (GSC/GA/PostHog) | ⬜ Still awaiting decision — see `decision-log.md` |
| **Self-seed knowledge graph** (new — see decision-log 2026-07-09) | ⬜ Not started — required because organic volume alone (1 real user) won't reach `MIN_SAMPLE_SIZE` in any reasonable timeframe pre-launch |

### Exit criteria for Phase 1

- ~~Migration applied in production, backfill run against real historical
  audits, `getGraphStats()` returns non-zero counts.~~ ✅ Met 2026-07-09.
- ~~Rollup script running nightly without manual intervention.~~ ✅ Met
  2026-07-09.
- At least one full week of new audits landing in the graph automatically
  via the live hook (verified via `GrowthArtifact` or direct query) — not
  yet observed at meaningful volume; superseded by the self-seed decision
  below since waiting on organic volume alone is not viable pre-launch.
- **New criterion (added 2026-07-09):** at least one `Issue` crosses
  `MIN_SAMPLE_SIZE = 20` distinct sites, via the self-seed batch. This is
  now the real Phase 1 → Phase 2 gate, not calendar time.

## Phase 2 — First public artifacts (not started)

**Goal:** ship the *smallest possible* real thing per family, gated by
`MIN_SAMPLE_SIZE`, and measure before scaling.

- `/issues/[checkId]` — one issue page, for whichever check has crossed the
  sample-size threshold first
- `/tools/meta-preview` — first free tool
- Extend `INDEXABLE_ROUTES`, `sitemap.ts`, `llms.txt` sections for the new
  families
- `seo-guard.mjs` assertions for the new route registries
- Basic analytics wiring (whatever access was granted in Phase 1)

### Exit criteria for Phase 2

- One issue page live, indexed, receiving impressions in GSC (if access
  granted) or at minimum verified crawlable via `curl` + robots checks.
- One free tool live, `ToolUsage` rows accumulating.
- A full weekly-review cycle completed at least once.

## Phase 3 — Scale the families that worked (not started)

- Expand `/issues/[checkId]` to all checks crossing the sample threshold
- `/benchmarks/[scope]` — first benchmark pages (industry × framework
  intersections with sufficient sample)
- Second and third free tools
- `/reports` public index (opt-in reports only)
- Sitemap split (`sitemap-static.xml`, `sitemap-issues.xml`,
  `sitemap-benchmarks.xml`)

## Phase 4 — Original research & comparisons (not started)

- `/compare/[slug]` pages
- First original-research piece backed by graph data (e.g. "we audited N
  Lovable-built landing pages — here's what breaks")
- Backlink program (tooling TBD — see `decision-log.md`)

## Explicitly deferred

- Programmatic pSEO at the "thousands of pages" scale — only after Phase 3
  proves the page families convert and hold up in the index. See
  `vision.md` non-goals: index bloat is a real risk, not a hypothetical one.
- Community features (Discord, forums)
- Paid acquisition — different owner, different system
