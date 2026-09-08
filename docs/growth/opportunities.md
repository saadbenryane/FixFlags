# Opportunities

Weekly GSC/analytics-derived opportunities plus clearly labeled structural
hypotheses. `scripts/growth/pull-gsc.ts` and `scripts/growth/pull-ga.ts`
produce dated snapshots; do not treat this narrative as fresher than those
artifacts.

## Latest measured state

GSC export fetched 2026-09-08T18:50Z for a rolling 28-day window, now
including page×query rows in `docs/growth/metrics/gsc-page-queries.json`:

- 7 clicks, 53 query impressions, 13.21% CTR, 1.83 impression-weighted
  average position
- 100% of query clicks from `fixflags` or close misspellings
- page×query shows `/pricing` (19 impressions, 0 clicks) and `/partners`
  (21 impressions, 0 clicks) appear only for `fixflags`. They are brand
  sitelinks, not separate commercial queries
- page totals still exceed joined rows, so some low-volume queries remain
  hidden. Do not invent them
- live sitemap still advertised invalid `::page:N` Flag URLs on production
  at this date

This is enough to justify brand-sitelink titles. It is not enough to
estimate non-brand demand or to justify a category-keyword campaign.

Refresh this section from the latest `docs/growth/metrics/` files, not from
memory.

## Structural opportunities

These are hypotheses, not measured opportunities. Re-prioritize them against
fresh GSC/GA data, a timestamped free SERP sample, current product truth, and
the graph's sample gates.

### Category ownership

- **"AI website audit" / "SEO audit" / "website audit".** Parked until
  ranking-strategy Phase C. Current GSC is branded-only. Those SERPs are
  occupied by Lighthouse, Ahrefs, Semrush, and generic scanners. Do not
  publish category pages to chase that volume.

### Builder-specific audiences

- **Builder-specific audiences** (Lovable, Cursor, Bolt, v0, Replit users)
  are large, active, and currently have no dedicated "does my AI-built site
  actually work" resource. The 5 tool-specific fix prompts already in the
  `Flag` model (`cursorPrompt`, `claudePrompt`, `lovablePrompt`,
  `boltPrompt`, `agentPrompt`) suggest the product already treats these as
  distinct audiences — growth content should mirror that segmentation.

### Free tool queries

- **"Open Graph preview checker"** and similar single-purpose tool queries
  are evergreen, high-intent, and low-competition relative to broader
  audit/QA terms. Good candidate for the first free tool (see `backlog.md`
  #2).
- **"Placeholder text detector"** / "AI slop detector" — queries from
  builders who suspect their AI-generated content has issues but don't know
  how to check. The placeholder-copy-detector tool directly serves this
  intent.

### Issue-driven queries

- **"[specific issue] + website"** queries (e.g., "missing og image fix",
  "cta below fold mobile", "placeholder copy detected") — these are
  high-intent, low-competition, and directly served by issue pages. Each
  issue page would target the specific check ID's query cluster.

### Research-driven queries

- **"How many AI-built sites have [issue]"** — original research queries
  that only FixFlags can answer with real data. These earn backlinks and
  social shares because they contain information gain no other source has.

## How to fill this in for real

On each fresh GSC pull:
1. Pull all queries with impressions > 0 but clicks = 0 and position 5-20 —
   these are "almost ranking" opportunities, typically the highest ROI fix
   (title/meta/content tweaks vs. building something new).
2. Pull queries with high impressions and low CTR relative to position —
   snippet/title problems, not ranking problems.
3. Cross-reference against `lib/graph/queries.ts::getGraphStats()` — do we
   have enough sample size to build a page that would satisfy the query
   intent? If not, that's a data-collection priority, not a content
   priority.
4. For each opportunity, estimate the conversion potential: does this query
   attract people who would run an audit? (vs. people who just want
   information and will leave)
