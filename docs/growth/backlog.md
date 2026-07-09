# Backlog

Ranked opportunity ledger. Format: one entry per opportunity, with an
estimated ROI rationale. Reordered whenever new data arrives (GSC pull,
graph stats, competitor research). This is **not** a sprint board — it's a
living priority list that the weekly review consults.

Until analytics access exists (see `decision-log.md`), ranking is based on
structural reasoning, not measured demand. Re-rank once real signal exists.

## Ranked

1. **Self-seed the knowledge graph with real audits against curated public
   sites.** (Superseded item, 2026-07-09: "run the Phase 1 migration +
   backfill" — that shipped this session. The real remaining blocker is
   sample size, not code.) Production has 1 real user pre-launch; organic
   volume alone will not reach `MIN_SAMPLE_SIZE = 20` in any useful
   timeframe. Run ~40-60 real audits against public AI-builder-output sites
   (Product Hunt launches, Lovable/Bolt/v0/Cursor-shipped landing pages) to
   unblock Phase 2 without fabricating any data. *(Phase 1 → unblocks Phase 2)*
2. **Decide analytics access** (GSC at minimum). Every ranking below this
   line is a guess until this exists. *(Phase 1 → gates Phase 2 prioritization)*
3. **Ship `/tools/meta-preview`.** Cheapest free tool to build (no audit
   pipeline dependency — just fetch + parse OG tags), highest expected
   top-of-funnel volume (broad, evergreen search intent: "og image
   checker", "open graph preview"). Can ship in parallel with #1 — no
   sample-size dependency.
4. **Ship the first `/issues/[checkId]` page** for whichever check crosses
   `MIN_SAMPLE_SIZE` first after the self-seed batch. Validates the entire
   graph → public-page pipeline end to end before building five more.
5. **`/tools/cta-above-fold`.** Directly reuses the audit pipeline's mobile
   screenshot capture — cheap to build once the pipeline is already running
   per-audit; more emotionally resonant CTA ("is my landing page
   embarrassing?") than meta-preview.
6. **`/tools/placeholder-copy-detector`.** No audit dependency at all — pure
   deterministic linter reusing `lib/audit/checks/slop.ts` rules. Good
   distribution potential among AI-builder communities (Reddit r/lovable,
   r/cursor, etc.) — see `competitors.md` once written.
7. **Industry/tech detection logic in `lib/graph/snapshot.ts`.** Currently
   stubbed to `null`/`[]`. Blocks `SiteTechnology` and `Industry` from ever
   populating, which blocks every benchmark page. Needs its own design pass
   (header sniffing? known builder fingerprints in HTML? existing
   `htmlMetadata` on Audit might already have signal — check before
   building new detection). Do this in parallel with the seed batch (#1) —
   real HTML from real builder output is the best test data for the
   heuristics.
8. **First `/benchmarks/[scope]` page**, once tech detection exists and a
   scope crosses sample size.
9. **Backlink tooling decision.** Free tier of something is fine to start
    (Moz free tier, or a GSC-based approach). Not urgent until Phase 4.

## Parked (revisit when unblocked)

- `/reports` public index — depends on having enough `isPublic` audits with
  PII-redaction verified. Needs a redaction pass audit before the toggle is
  meaningfully safe to expose broadly.
- `/compare/[slug]` — depends on having audited the same URL through
  multiple lenses; low volume until then.
- Programmatic pSEO scale-out (industry × builder matrices) — explicitly
  deferred per `roadmap.md` Phase 4+; premature before smaller families
  prove out.

## How to re-rank

When new data arrives (GSC pull, graph stats snapshot, competitor
intelligence), re-run this prioritization with the actual numbers instead of
structural reasoning. Log the re-rank as a `decision-log.md` entry if it
changes what ships next, so we can trace "why did we build X before Y" later.
