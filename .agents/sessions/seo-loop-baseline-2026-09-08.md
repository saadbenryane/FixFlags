# SEO loop baseline and crawl intervention

Date: 2026-09-08
Owner: cursor-seo-loop
Branch: main
Outcome: implemented locally
Intervention: SEO-CRAWL-001

## Measurement

Authorized GSC and GA4 pulls refreshed rolling 7-day and 28-day artifacts.
The committed files retain the 28-day baseline; both segments were persisted
as `GrowthArtifact` records.

- 28-day GSC query data: 7 clicks, 53 impressions, 13.21% CTR, 1.83
  impression-weighted average position, all clicks branded
- 7-day GSC query data: 3 clicks, 11 impressions, 27.27% CTR, 1.09 average
  position, all clicks branded
- 28-day GA4: 549 sessions, 10 from Google, 19 Site-analysis starts overall
- 7-day GA4: 64 sessions, 2 from Google, 4 Site-analysis starts overall

GA4 cannot attribute the starts specifically to Google sessions. Query and
page GSC exports use independent aggregation and were not summed.

## Live research

At 2026-09-08T17:21Z:

- `/sitemap.xml`, `/robots.txt`, `/issues`, and a sampled issue page returned
  HTTP 200 on repeated checks
- the sitemap advertised 19 `::page:N` issue URLs
- sampled page-variant URLs returned Not Found
- the `no-structured-data` page repeated one related issue link three times
- an earlier sitemap 500 was transient and not reproducible
- free brand SERP research showed third-party pages and production still
  using the prior product positioning

The search sample was too small and branded to justify a title or content
experiment.

## Change

- `lib/graph/queries.ts` excludes page-scoped check variants from indexable
  issue IDs at both SQL and projection boundaries
- `lib/graph/related.ts` excludes page variants and deduplicates check IDs
  across same-rubric and shared-technology results
- focused regression tests preserve both contracts
- `docs/growth/experiments.md` and
  `docs/growth/weekly-review/2026-W37.md` hold the baseline and follow-up rule

## Verification

Passed:

- focused graph projection suites
- `npm run agent -- eval growth`
- `npm run seo:guard`
- `npm run skills:validate`
- focused ESLint and IDE diagnostics
- `npm run agent -- verify --dry-run`
- local database sitemap projection: 73 distinct URLs, zero `::page:N`
  variants, zero duplicates
- local `no-structured-data` related projection: three distinct canonical URLs

Known unrelated blocker:

- `npm run metadata:route-guard` still reports the pre-existing unchanged
  `/protect` metadata-helper violation

## Next observation

Not deployed. After the release owner deploys this work, verify the
production sitemap immediately. Review GSC on 2026-09-15 or after a confirmed
recrawl. Keep the intervention only if invalid sitemap entries are zero and
eligible canonical issue pages remain present.
