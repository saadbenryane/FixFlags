# Ranking strategy

Read this during the research step of every cycle. Do not treat it as a
keyword list to publish against. Dated numbers belong in
`docs/growth/metrics/` and the current weekly review, not here.

## How ranking actually improves

Google does not reward a private keyword board. It rewards a page that
satisfies a searcher's task better than the pages already ranking, then
keeps that page crawlable, canonical, and trustworthy.

For FixFlags that means:

1. A real visitor job: look after a website, diagnose a Flag, preview a
   share card, or understand why a journey failed.
2. A page that completes that job with original evidence or a working
   diagnostic.
3. A title, heading, and snippet that honestly describe that job.
4. A crawlable canonical URL that is not duplicated, thin, or 404.
5. Links, mentions, and reuse that follow from usefulness, not outreach
   theater.

Do not compete on generic `website audit` volume until FixFlags pages
already satisfy narrower jobs and accumulate independent citations.

## How to read current performance

Split every snapshot into four questions:

1. **Discovery:** which queries and pages earn impressions?
2. **Click:** which of those impressions become clicks?
3. **Use:** do organic landings start a Site analysis or complete a
   promised tool/task?
4. **Index health:** can Google fetch the canonical URL, and is the
   advertised sitemap truthful?

Interpretation rules:

- Brand share of 100% means people who already know the name can find
  it. That is not category demand.
- Impression-weighted average position near 1 on brand queries is
  expected. It does not prove non-brand ranking.
- Page impressions without matching query rows usually mean hidden
  low-volume queries. Do not invent those queries.
- GSC page and query totals must not be summed. They are independent
  aggregations.
- GA4 `google` sessions are not a ranking report. Keep them as a
  qualified-visit guardrail, not as SERP proof.
- If production HTML still shows retired positioning while the
  repository has newer copy, that is a deploy/index problem, not a
  keyword problem.

## Keyword map

Map demand to visitor jobs. Refresh the map from GSC first, then from
timestamped SERP samples. Never invent volume.

| Cluster | Visitor job | Typical queries | FixFlags surface | When to act |
| --- | --- | --- | --- | --- |
| Brand | Find this product | `fixflags`, close misspellings | Homepage and docs | Always keep accurate and canonical |
| Outcome / care | Know if the website still does its job | website looked after, website monitoring, contact form not confirming, checkout broken | Homepage, Outcome/Flag pages, verification stories | After the live site matches current product truth |
| Flag / issue | Diagnose a specific failure | missing og image, CTA below fold mobile, no structured data | `/issues/[checkId]` | Only when the page is sample-gated, unique, and indexed |
| Tool / diagnostic | Complete one check immediately | open graph preview, placeholder copy detector | `/tools/*` | When the tool already does the job and the SERP is crowded with generic checkers |
| Category | Compare audit products | website audit, SEO audit, lighthouse alternative | Compare or research pages | Late. These SERPs are occupied by Lighthouse, Ahrefs, Semrush, and generic scanners |

Targeting order:

1. Own brand completely. If extra URLs earn impressions for the same
   brand query, treat them as sitelinks: their titles must still name
   FixFlags. Vague labels waste the only measured demand.
2. Capture Flag and tool queries that existing unique pages already serve.
3. Earn Outcome/care queries with first-hand evidence.
4. Approach category queries only after citations and non-brand
   impressions exist.

On a brand relaunch, keep the name first in the official snippet. Connect
the remembered job (live URL, evidence, a fix in tools people already
use) to the current job (the website is looked after). Do not restore a
retired tagline. Do not write copy that could be read as feature-flag
infrastructure.

A query is eligible only if:

- a real FixFlags audience would search it
- a current page or honest new page can satisfy it
- the page adds information or utility competitors cannot copy cheaply
- the next step can be a useful Site analysis, not a dead-end article

## Competition analysis

There are two different competitor sets. Do not mix them.

- **Product competitors** live in `docs/growth/competitors.md`: Scout QA,
  Signo, PageLens, and adjacent audit tools. Use them for positioning,
  not as a default SERP map.
- **SERP competitors** are whoever currently occupies the result list for
  a target query. For tool queries that is often Open Graph checkers. For
  form-failure queries that is WordPress SMTP tutorials. For category
  queries that is Lighthouse, Ahrefs, Semrush, and generic scanners.

For each candidate query, timestamp a free SERP sample and record:

- query, locale, device, date
- the top results and their format: tool, tutorial, docs, marketplace,
  or AI overview
- the job those pages actually complete
- what FixFlags uniquely adds: observed Flag evidence, verification,
  coverage honesty, or a working diagnostic
- whether FixFlags already has a canonical page for that job
- whether winning would attract people who might start a Site analysis

If the SERP is a WordPress plugin tutorial and FixFlags cannot complete
that plugin-specific job, skip the query. If the SERP is a generic
checker and FixFlags can show the same check plus Flag evidence and a
path to Verify, that is a candidate.

## Operating phases

Choose the current phase from evidence, then pick one intervention
inside that phase.

### Phase A: Foundation

Symptoms: branded-only queries, few indexed URLs, 404s in the sitemap,
hostname splits, production copy behind the accepted vision.

Work: crawl/index repairs, canonical hostname, truthful sitemap, deploy
current product truth, prune invalid URLs.

Do not write keyword pages in this phase.

### Phase B: Useful capture

Symptoms: foundation defects closed; some non-brand impressions or
clear SERP jobs that existing tools/issue pages already satisfy.

Work: improve titles and intent fit on existing unique pages, internal
links between related Flags/tools, and one diagnostic that completes a
real task.

### Phase C: Authority

Symptoms: repeated non-brand impressions, citations, or demand for
original evidence.

Work: sample-gated research, Outcome-led guides, verification stories,
and only then broader category pages.

## Cycle briefing

Every weekly review must include:

- dated GSC brand vs non-brand split
- pages earning impressions and whether they are canonical
- current phase
- keyword map updates from measured or sampled queries
- at least one timestamped SERP competition note
- why the chosen intervention beats competing on a generic category term
