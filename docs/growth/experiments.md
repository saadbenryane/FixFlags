# Experiments

Append-only hypothesis to implementation to outcome log. Pre-register an
intervention before editing, then append dated observations and the final
decision to the same entry. Never rewrite the baseline after seeing results.

Template for new SEO entries:

```md
## SEO-[TYPE]-[NNN] - [title]

**Registered:** YYYY-MM-DD
**Status:** planned | implemented | observing | concluded
**Target:** query, canonical page, audience, and intent
**Evidence window:** exact dates, property, country/device/search-type filters
**Baseline:** clicks, impressions, CTR, impression-weighted average position,
and one product/business guardrail
**Data caveats:** missing rows, small sample, partial period, attribution limits

**Hypothesis:** If we make [exact change], then [primary metric] should move
because [causal mechanism], without harming [guardrail].

**Exact implementation:** files and visible behavior to change
**Primary metric:** one search metric
**Guardrail:** one qualified product or business metric
**Observation window:** next comparable measurement date or recrawl condition
**Decision rule:** what means keep, revise, revert, or inconclusive
**Confidence and evidence:** low | medium | high, with dated sources

### YYYY-MM-DD observation

- Applied/deployed:
- Crawled/reprocessed:
- Comparable result:
- Confounders:
- Next action:

### Conclusion

**Decision:** keep | revise | revert | inconclusive
**Outcome:** baseline to result for the primary metric and guardrail
**Lessons learned:** reusable finding, if any
**Future recommendation:** what this unlocks or rules out
```

Search Console average position is not an exact live rank. Keep manual SERP
observations timestamped and separate from first-party performance metrics.

---

## SEO-SNIPPET-001 - Brand sitelink titles for the new care story

**Registered:** 2026-09-08
**Status:** implemented, awaiting deployment and recrawl
**Target:** query `fixflags`; canonical pages `/`, `/pricing`, and
`/partners`; people who already know the name and need the official product,
cost, or studio-delivery answer
**Evidence window:** GSC web data pulled 2026-09-08T18:50Z for a rolling
28-day window, including page×query rows; free SERP samples the same evening
**Baseline:** 7 query clicks, 53 query impressions, all branded.
Page×query shows `/pricing` (19 impressions, 0 clicks, position 9.37) and
`/partners` (21 impressions, 0 clicks, position 7.43) appear only for
`fixflags`, not for distinct commercial queries. Homepage CTR for
`fixflags` is 10.5% on apex and 27.3% on www. Production titles still use
the retired AI-QA story; Google still shows directory leftovers on the
retired tagline.
**Data caveats:** page totals still exceed joined page×query rows, so some
low-volume queries remain hidden. Sample is tiny. GA4 cannot join Google
sessions to Site starts.

**Hypothesis:** If the official homepage, pricing, and partners snippets
name FixFlags, describe the live-website check with evidence and a fix
path, and drop vague labels (`Pricing`, `Expert program`) plus retired
tagline language, then brand searchers will recognize the same product
under the care story and click the official sitelinks, without harming
brand clicks or Site starts.

**Exact implementation:** Update `lib/marketing/copy/seo.ts` titles and
descriptions for home, pricing, and partners; align roast metadata away
from grade language; replace the Shopify-only pricing note in
`lib/marketing/seo-routes.ts` llms copy. Do not rewrite homepage editorial
sections.
**Primary metric:** combined CTR on `/pricing` and `/partners` for query
`fixflags` after recrawl, from a 0% baseline
**Guardrail:** homepage `fixflags` clicks and GA4 Google sessions do not
collapse versus the 2026-09-08 baseline
**Observation window:** immediate production title check after deploy;
first GSC page×query compare on 2026-09-15 or after a confirmed recrawl
**Decision rule:** keep if official titles are live and sitelink CTR does
not fall while brand clicks hold; revise if Google ignores the new titles
or sitelink CTR stays at zero after recrawl; revert if brand clicks or
Google sessions drop without a matching crawl or SERP confounder
**Confidence and evidence:** medium for clearer brand recognition, low for
near-term ranking movement. Evidence is the 2026-09-08 page×query pull and
timestamped directory SERP leftovers.

### 2026-09-08 observation

- Applied/deployed: implemented locally in copy, llms notes, roast metadata,
  and page×query export; not deployed
- Crawled/reprocessed: no
- Comparable result: n/a
- Confounders: production homepage and pricing HTML are behind the
  repository; SEO-CRAWL-001 is in the same unpublished cut; Google snippets
  for `/pricing` still showed stale $69/$199 copy in a 2026-09-08 search
- Next action: deploy with crawl repairs, then compare page×query CTR on
  2026-09-15

---

## SEO-CRAWL-001 - Keep page-scoped Flag variants out of public discovery

**Registered:** 2026-09-08
**Status:** implemented, awaiting deployment and recrawl
**Target:** `/sitemap.xml`, `/issues`, and issue-page related links for people
and crawlers navigating the public Flag Library
**Evidence window:** GSC web data pulled 2026-09-08 for rolling 7-day and
28-day windows; live production inspection at 2026-09-08T17:21Z
**Baseline:** GSC's 28-day query export has 7 clicks, 53 impressions, 13.21%
CTR, and 1.83 impression-weighted average position, all from branded or
brand-adjacent queries. The live sitemap exposes 19 `::page:N` URLs that
return Not Found, and one sampled issue page renders the same related URL
three times.
**Data caveats:** GSC query and page dimensions aggregate independently and
the API may omit low-volume rows. The current GA4 export has 10 Google
sessions in 28 days, but it cannot attribute Site starts to those sessions.
This intervention has crawl-quality evidence, not ranking causality.

**Hypothesis:** If public discovery surfaces expose only canonical base check
IDs and deduplicate related links, then crawlers and visitors will stop
receiving known Not Found Flag URLs, without reducing access to valid
sample-gated issue pages.

**Exact implementation:** Filter page-scoped `::page:N` check variants from
the indexable issue query, deduplicate related issues by canonical check ID,
and add regression tests for both public projections.
**Primary metric:** zero `::page:N` URLs in the generated sitemap after
deployment
**Guardrail:** canonical sample-gated issue URLs and up to three distinct
related issue links continue to render
**Observation window:** verify immediately after deployment, then inspect GSC
page/indexing data after Google recrawls the sitemap; first review 2026-09-15
**Decision rule:** keep if invalid sitemap entries are zero and valid issue
coverage remains; revise if variants still leak through another public query;
revert if canonical eligible issues disappear.
**Confidence and evidence:** high for removing invalid discovery URLs, low for
near-term ranking impact. Evidence is the live sitemap and sampled 404 pages.

### 2026-09-08 observation

- Applied/deployed: implemented and regression-tested locally; not deployed
- Crawled/reprocessed: no
- Comparable result: the local database projection generated 73 distinct
  sitemap URLs with zero page variants or duplicates; the sampled issue
  returned three distinct related links
- Confounders: current production still uses legacy homepage/product wording;
  GSC volume is small and branded
- Next action: deploy through the release owner, verify zero `::page:N` URLs
  in production, then review GSC after recrawl

---

The entries below predate the first executed SEO loop and remain historical
planned experiments until separately re-baselined.

---

## [PLANNED] First issue page: does data-backed content earn organic traffic?

**Hypothesis:** A page that displays FixFlags-unique data (issue frequency,
top frameworks, anonymized examples, canonical fix prompt) will earn organic
impressions within 4 weeks of indexing, at a higher rate than a generic
"what is X issue" article — because it carries information gain no other
page has.

**Implementation:** Ship `/issues/[checkId]` for the first check crossing
MIN_SAMPLE_SIZE after the self-seed batch. Include structured data
(`Article` + `Dataset`), internal links to related issues, and an audit CTA.

**Success metric:** >500 impressions within 30 days of indexing (GSC data),
or >100 impressions within 30 days if GSC access is not yet available
(fallback: verify crawlable via `curl` and robots checks).

**Outcome:** (fill after implementation)

**Lessons learned:** (fill after outcome)

**Future recommendations:** (fill after lessons)

---

## [PLANNED] Free tool conversion: does meta-preview drive audit starts?

**Hypothesis:** A free OG preview checker tool will generate top-of-funnel
traffic and convert a meaningful percentage of users into audit starts —
because the tool demonstrates FixFlags' capability and the natural next step
is "run a full audit."

**Implementation:** Ship `/tools/meta-preview` with a prominent "Run a full
audit" CTA below the tool result. Track via `ToolUsage` with `sessionId`
correlation to `Audit.source`.

**Success metric:** >15% of tool sessions result in an audit start (measured
via `ToolUsage.sessionId` → `Audit` correlation). >100 tool uses within 30
days.

**Outcome:** (fill after implementation)

**Lessons learned:** (fill after outcome)

**Future recommendations:** (fill after lessons)
