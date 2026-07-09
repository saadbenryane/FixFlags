# Metrics

KPI definitions and current values. Updated weekly once analytics access and
the rollup job are live. Until then, this file defines what we'll measure and
why — not live numbers.

## Organic

| Metric | Definition | Source | Current value |
|---|---|---|---|
| Impressions | Search impressions across all indexed URLs | GSC | Not yet available |
| Clicks | Search clicks | GSC | Not yet available |
| Avg. position | Mean SERP position for tracked queries | GSC | Not yet available |
| Indexed pages | Count of URLs Google has indexed | GSC (Coverage report) | Not yet available |
| Branded search share | % of clicks from queries containing "fixflags" | GSC | Not yet available |
| Referring domains | Distinct domains linking to fixflags.com | Backlink tool (TBD) | Not yet available |

## Product

| Metric | Definition | Source | Current value |
|---|---|---|---|
| Audit starts | Count of `started_audit` events | `lib/analytics/events.ts` (GA) | Tracked in GA already — not yet pulled into this doc |
| Audit completion rate | completed / started | GA + DB (`Audit.status`) | Not yet computed here |
| Signups | Count of `signed_up` events | GA | Tracked in GA already |
| Paid conversion | Count of `completed_checkout` | GA + Stripe | Tracked already |
| Report sharing | Views of `/report/[id]` from non-owner | DB (`viewed_report`, `is_owner`) | Not yet computed here |
| Revenue from organic | Stripe revenue attributed to `source = ORGANIC` | DB (`Audit.source`) + Stripe | Not yet computed here |

## Technical

| Metric | Definition | Source | Current value |
|---|---|---|---|
| Crawl health | 4xx/5xx rate on crawled URLs | GSC Crawl Stats | Not yet available |
| Core Web Vitals | LCP/CLS/INP on marketing pages | PageSpeed / CrUX | Not yet available |
| Structured data coverage | % of indexable routes with valid schema | `seo-guard.mjs` (extend) | Currently: Organization/WebSite/SoftwareApplication/FAQPage on home + FAQ only |
| Duplicate content | Near-duplicate programmatic pages detected | Manual / future guard | N/A — no programmatic pages shipped yet |

## Knowledge (the graph)

| Metric | Definition | Source | Current value |
|---|---|---|---|
| Sites in graph | `Site.count()` | `lib/graph/queries.ts::getGraphStats()` | Not yet run against production data |
| Pages in graph | `Page.count()` | same | — |
| Issues tracked | `Issue.count()` | same | — |
| Occurrences logged | `IssueOccurrence.count()` | same | — |
| Benchmark snapshots | `BenchmarkSnapshot.count()` | same | 0 — not built yet |
| Issue pages published | Count of checkIds crossing `MIN_SAMPLE_SIZE` | manual query | 0 — Phase 2 |
| Free tools live | Count of shipped `/tools/*` routes | manual | 0 — Phase 2 |

## How to update this file

Run `getGraphStats()` (add a small script or query via `db:studio`) and paste
the numbers here weekly, alongside the weekly-review cycle. Once
`scripts/growth/pull-gsc.ts` exists, its output feeds the Organic section
automatically — see `roadmap.md` Phase 2.
