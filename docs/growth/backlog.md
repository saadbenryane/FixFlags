# Backlog

Ranked opportunity ledger. Format: one entry per opportunity, with an
estimated ROI rationale. Reordered whenever new data arrives (GSC pull,
graph stats, competitor research). This is **not** a sprint board — it's a
living priority list that the weekly review consults.

Until analytics access exists (see `decision-log.md`), ranking is based on
structural reasoning, not measured demand. Re-rank once real signal exists.

## Ranked

### P0 — Ship immediately (no blockers)

1. **Self-seed the knowledge graph with real audits against curated public
   sites.** Production has 1 real user pre-launch; organic volume alone will
   not reach `MIN_SAMPLE_SIZE = 20` in any useful timeframe. Run ~40-60
   real audits against public AI-builder-output sites (Product Hunt launches,
   Lovable/Bolt/v0/Cursor-shipped landing pages) to unblock Phase 2 without
   fabricating any data. *(Phase 1 -> unblocks Phase 2)*

2. **Ship `/tools/meta-preview`.** Cheapest free tool to build (no audit
   pipeline dependency — just fetch + parse OG tags), highest expected
   top-of-funnel volume (broad, evergreen search intent: "og image
   checker", "open graph preview"). Can ship in parallel with #1 — no
   sample-size dependency. Writes `ToolUsage` for conversion tracking.
   *(Phase 2 — no blockers)*

3. **Ship `/tools/placeholder-copy-detector`.** No audit dependency at all —
   pure deterministic linter reusing `lib/audit/checks/slop.ts` rules. Good
   distribution potential among AI-builder communities (Reddit r/lovable,
   r/cursor, etc.). *(Phase 2 — no blockers)*

### P1 — Ship after P0 or in parallel if capacity allows

4. **Implement industry/tech detection in `lib/graph/snapshot.ts`.**
   Currently stubbed to `null`/`[]`. Blocks `SiteTechnology` and `Industry`
   from ever populating, which blocks every benchmark page. Needs its own
   design pass (header sniffing? known builder fingerprints in HTML? existing
   `htmlMetadata` on Audit might already have signal — check before building
   new detection). Do this in parallel with the seed batch (#1) — real HTML
   from real builder output is the best test data for the heuristics.
   *(Phase 1 -> unblocks benchmark pages)*

5. **Decide analytics access** (GSC at minimum). Every ranking below this
   line is a guess until this exists. *(Phase 1 -> gates Phase 2 prioritization)*

6. **Ship the first `/issues/[checkId]` page** for whichever check crosses
   `MIN_SAMPLE_SIZE` first after the self-seed batch. Validates the entire
   graph -> public-page pipeline end to end before building five more.
   *(Phase 2 — blocked on sample size)*

7. **Design and implement attribution system.** Add UTM parameters to all
   public surface links and extend `Audit.source` enum with new values
   (`ISSUE_PAGE`, `BENCHMARK_PAGE`, `TOOL_PAGE`, `REPORT_INDEX`). This is
   the measurement foundation — without it, we can't know which surfaces
   drive conversions. *(Phase 2 — no blockers, but low urgency until pages exist)*

### P2 — Ship after Phase 2 first artifacts are live

8. **Build `lib/graph/related.ts` — internal linking engine.** Query the
   graph to find related pages (same rubric, same framework, same check
   category). Renders as "Related issues" or "See also" sections on public
   pages. Creates topical authority clusters. *(Phase 2 — needs issue pages)*

9. **Expand structured data** for issue pages (`Article` + `Dataset`),
   benchmark pages (`Dataset` + `Report`), and free tools (`SoftwareApplication`
   + `WebAPI`). *(Phase 2 — needs page templates)*

10. **Implement dynamic sitemap** from knowledge graph. As issues cross
    MIN_SAMPLE_SIZE, they automatically appear in the sitemap without manual
    intervention. *(Phase 2 — needs page templates)*

11. **`/tools/cta-above-fold`.** Directly reuses the audit pipeline's mobile
    screenshot capture — cheap to build once the pipeline is already running
    per-audit; more emotionally resonant CTA ("is my landing page
    embarrassing?") than meta-preview. *(Phase 2 — needs audit pipeline)*

### P3 — Ship in Phase 3

12. **`scripts/growth/rollup-benchmarks.ts`** — compute `BenchmarkSnapshot`
    per scope weekly. Depends on #4 (tech detection). *(Phase 3)*

13. **First `/benchmarks/[scope]` page**, once tech detection exists and a
    scope crosses sample size. *(Phase 3)*

14. **`scripts/growth/opportunity-scoring.ts`** — rank pages by
    impressions x CTR gap x conversion potential. Depends on #5 (GSC
    access). *(Phase 3)*

15. **`scripts/growth/weekly-review.ts`** — automated weekly review
    composition from live data. Depends on #5 (GSC access). *(Phase 3)*

16. **`/reports` public index** — opt-in reports only. Needs a PII-redaction
    audit before the toggle is meaningfully safe to expose broadly.
    *(Phase 3)*

### P4 — Ship in Phase 4

17. **Backlink tooling decision.** Free tier of something is fine to start
    (Moz free tier, or a GSC-based approach). Not urgent until Phase 4.
    *(Phase 4)*

18. **`/compare/[slug]` pages** — depends on having audited the same URL
    through multiple lenses. *(Phase 4)*

19. **First original-research piece** backed by graph data. *(Phase 4)*

## Parked (revisit when unblocked)

- Programmatic pSEO scale-out (industry x builder matrices) — explicitly
  deferred per `roadmap.md` Phase 4+; premature before smaller families
  prove out.

## How to re-rank

When new data arrives (GSC pull, graph stats snapshot, competitor
intelligence), re-run this prioritization with the actual numbers instead of
structural reasoning. Log the re-rank as a `decision-log.md` entry if it
changes what ships next, so we can trace "why did we build X before Y" later.
