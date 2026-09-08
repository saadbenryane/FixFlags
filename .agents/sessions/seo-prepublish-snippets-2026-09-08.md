# Pre-publish SEO snippets and page×query measurement

Date: 2026-09-08
Owner: cursor-seo-loop
Branch: main
Outcome: implemented locally
Intervention: SEO-SNIPPET-001 (with SEO-CRAWL-001 still awaiting the same production cut)

## Measurement

Authorized 28-day GSC pull at 2026-09-08T18:50Z, now including page×query
rows in `docs/growth/metrics/gsc-page-queries.json`.

- Query export: 7 clicks, 53 impressions, all branded
- `/pricing` × `fixflags`: 19 impressions, 0 clicks, position 9.37
- `/partners` × `fixflags`: 21 impressions, 0 clicks, position 7.43
- Homepage × `fixflags` still receives the clicks
- Page totals still exceed joined rows; hidden queries were not invented

## SERP sample

Same evening free web searches:

- `fixflags`: Founder DB and AgentSpot still use "Finish what your AI started."
- `fixflags pricing`: official `/pricing` appeared with stale $69/$199 snippet text
- `fixflag`: directories, 株式会社FixFlag, GalliumOS firmware images
- FFlags (fflags.com) is a feature-flag collision, not a product competitor

## Change

- Page×query GSC export and focused mapping tests
- Brand sitelink titles and descriptions for home, pricing, and partners
- Roast metadata aligned to the canonical SEO module, without a grade promise
- llms.txt pricing/home notes no longer sell Shopify-only discovery
- Live verification script for titles, www redirect, and sitemap variants
- Category-keyword backlog advice parked until Phase C

## Next observation

Not deployed. After the release owner ships this cut with `SEO-CRAWL-001`,
run `npm run growth:verify-live`, then compare page×query CTR on 2026-09-15
or after recrawl. Do not start Flag or tool title work before that compare.
