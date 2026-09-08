# Backlog

Ranked opportunity ledger. Format: one entry per opportunity, with an
estimated ROI rationale. Reordered whenever new data arrives (GSC pull,
graph stats, competitor research). This is **not** a sprint board — it's a
living priority list that the weekly review consults.

GSC and GA4 export paths now exist, but the latest committed search snapshot
is low-volume and mostly branded. Ranking therefore remains provisional.
Re-rank after each comparable SEO growth-loop measurement.

## Ranked

### ✅ Completed (2026-07-10 implementation batch)

1. **Self-seed the knowledge graph** — 4-phase script (queue → poll → rollup
   → report) ships. Ready to run against 60 curated URLs once the worker is
   active. *(scripts/growth/self-seed.ts)*

2. **`/tools/meta-preview`** — Free tool that fetches a URL and displays OG
   tags, social preview card, and meta metadata. Writes `ToolUsage` rows.
   *(app/(marketing)/tools/meta-preview + app/api/tools/meta-preview)*

3. **`/tools/placeholder-copy-detector`** — Scans a URL for lorem ipsum,
   TODO markers, AI-builder template artifacts, unreplaced tokens, and social
   proof slop. Writes `ToolUsage` rows.
   *(app/(marketing)/tools/placeholder-detector + app/api/tools/placeholder-detector)*

4. **Industry/tech detection** — Already connected end-to-end:
   `run-page.ts` calls `detectTechnologies()` + `inferIndustry()`, stores
   in `AuditPage.performanceData`, `snapshot.ts` extracts and passes to
   `persist.ts` which upserts `SiteTechnology` rows and sets
   `Site.industryGuess`. *(lib/audit/tech-detect.ts → lib/graph/snapshot.ts → lib/graph/persist.ts)*

7. **Attribution system** — `AuditSource` enum extended with `TOOL_PAGE`,
   `ISSUE_PAGE`, `BENCHMARK_PAGE`. `CLIENT_SOURCES` and `inferAuditSource`
   updated. Migration created. *(lib/leads/attribution.ts, prisma/schema.prisma)*

### P0 — Current priorities

5. ~~**Complete the first SEO growth-loop baseline.**~~ Done 2026-09-08
   (`SEO-CRAWL-001` plus page×query measurement).

6. **Ship the unpublished SEO cut and observe it.** Deploy
   `SEO-CRAWL-001` and `SEO-SNIPPET-001` with current product HTML. Verify
   production titles, `www` → apex, and a clean sitemap, then compare
   page×query CTR on 2026-09-15. Do not start Flag or tool title work
   before that recrawl.

7. **Verify the existing sample-gated issue-page path in production.**
   Confirm at least one eligible `/issues/[checkId]` URL is crawlable,
   canonical, included in the sitemap, and indexed. Title copy for Flag
   pages waits until this production evidence exists.

Deferred from earlier P0/P2 advice: do **not** build category pages for
`website audit`, `SEO audit`, or `AI website audit` while GSC remains
branded-only.

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
    per scope weekly. *(Phase 3)*

13. **First `/benchmarks/[scope]` page**, once a scope crosses sample size.
    *(Phase 3)*

14. **`scripts/growth/opportunity-scoring.ts`** — rank pages by
    impressions x CTR gap x conversion potential. *(Phase 3 — needs enough
    non-brand GSC signal to validate the scoring model)*

15. **`scripts/growth/weekly-review.ts`** — automated weekly review
    composition from live data. *(Phase 3 — automate only after the manual
    artifact and decision contract proves stable)*

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
  deferred per `growth-roadmap.md` Phase 4+; premature before smaller families
  prove out.

## How to re-rank

When new data arrives (GSC pull, graph stats snapshot, competitor
intelligence), re-run this prioritization with the actual numbers instead of
structural reasoning. Log the re-rank as a `decision-log.md` entry if it
changes what ships next, so we can trace "why did we build X before Y" later.
