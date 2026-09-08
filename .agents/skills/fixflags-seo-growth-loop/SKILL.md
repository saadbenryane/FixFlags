---
name: fixflags-seo-growth-loop
description: Continuously improve FixFlags organic search performance through evidence-backed build, measure, and learn cycles. Use for SEO rankings, Search Console opportunities, indexing, crawl health, titles and CTR, keyword targeting, competitor SERP analysis, content refreshes, internal links, organic acquisition, or weekly growth reviews. Unlike fixflags-marketing, this skill owns measurement, keyword strategy, and experiment closure.
---

# FixFlags SEO growth loop

Read `AGENTS.md`, `knowledge/vision.md`, `docs/growth/README.md`, and the latest entry in `docs/growth/weekly-review/`.
Read `PRODUCT.md` for shipped behavior and `ROADMAP.md` for future behavior. Never present roadmap work as available.

This is a project skill, not a separate SEO agent runtime. Use the repository's existing GSC, GA4, graph, SEO, and verification paths. Do not require a paid SERP provider.

## Goal

Improve qualified organic discovery and the customer loop:

`search discovery -> useful public evidence -> Site analysis -> understood Flag -> Fix -> Verify -> Watch`

Rankings are an intermediate signal. Prefer improvements that help the intended visitor and lead to meaningful product use.

## State check

Before proposing or changing anything:

1. Inspect current ownership in `.agents/BOARD.md` and preserve other agents' work.
2. Read the latest completed SEO experiment and weekly review.
3. Inspect `docs/growth/metrics/` freshness. A committed export is a snapshot, not live data.
4. Check whether GSC and GA4 can be read without printing secrets:

```bash
npm run growth:pull-gsc -- --days=28
npm run growth:pull-ga -- --days=28
```

Run credentialed pulls only when the user authorized live measurement. If credentials are missing, use existing artifacts and label their date. Never invent a value.

5. Inspect the target URL as rendered and verify its canonical, title, description, heading, robots status, sitemap inclusion, structured data, internal links, and real customer value.
6. For current external facts or SERP observations, research the live web and timestamp the observation.

If reliable baseline data is unavailable, complete a baseline or blocker pass. Do not force an implementation.

## One cycle

### 1. Measure

Compare equivalent windows and segments. Record:

- GSC clicks, impressions, CTR, and impression-weighted average position by query and page
- GA4 organic landing activity and the relevant product funnel events
- crawl, index, canonical, sitemap, and rich-result state where available
- the prior intervention's applied state and outcome

GSC average position is not an exact rank. Search Analytics may omit low-volume rows and returns top data, so state coverage and sample limitations. Keep observed SERP snapshots separate from GSC metrics.

### 2. Research

Read [references/google-search-principles.md](references/google-search-principles.md) before a content, metadata, structured-data, or technical SEO change.
Read [references/ranking-strategy.md](references/ranking-strategy.md) before choosing a keyword, competitor, or ranking intervention.

Build a short briefing, not a keyword dump:

- current performance: brand vs non-brand, pages earning impressions, crawl/index health, organic use
- current phase: foundation, useful capture, or authority
- keyword map: visitor job, candidate queries, existing FixFlags surface, eligibility
- SERP competition: timestamped sample of who currently occupies the job, distinct from product competitors in `docs/growth/competitors.md`

For the target query or topic:

- identify the visitor's task and likely intent
- inspect FixFlags' current page and nearby internal-link cluster
- sample the current results and the pages that satisfy the task well
- look for information or utility only FixFlags can provide from real Site, Outcome, Flag, coverage, verification, or graph evidence
- verify claims against current product behavior and attributable data

Do not copy competitors. Use them to reveal an unmet task, evidence gap, format expectation, or clarity problem.
Do not target generic `website audit` or `SEO audit` volume during the foundation phase.

### 3. Generate creative candidates

Use [references/opportunity-playbook.md](references/opportunity-playbook.md). Generate candidates across at least three different mechanisms, such as:

- improve an existing result's relevance or click appeal
- repair crawl, canonical, rendering, or structured-data friction
- strengthen a useful internal-link path
- turn unique FixFlags evidence into original research
- build a small tool or diagnostic that completes a real task
- consolidate overlapping pages or remove thin indexable surfaces

Creativity must increase usefulness or information gain. More pages is not a goal.

### 4. Choose one intervention

Rank candidates by:

`expected qualified impact x evidence strength x confidence / effort and risk`

Choose one intervention unless several edits are inseparable parts of the same hypothesis. Pre-register it in `docs/growth/experiments.md` with:

- stable ID: `SEO-<TYPE>-NNN`
- target query, page, audience, and intent
- dated baseline and data source
- expected causal mechanism
- primary search metric and product/business guardrail
- exact change
- confidence and evidence
- observation window
- keep, revise, or revert rule

Never optimize solely for raw traffic. Guard against lower-quality visits, weaker Site starts, misleading claims, accessibility regressions, and slower pages.

### 5. Build

Claim the scope on `.agents/BOARD.md` before edits. Follow the canonical source:

- rendered marketing copy: `lib/marketing/copy.ts` and its modules
- indexable route registry: `lib/marketing/seo-routes.ts`
- public graph reads: `lib/graph/queries.ts`
- sitemap and robots: `app/sitemap.ts`, `app/robots.ts`
- growth ingestion: `lib/growth/`

Make the smallest coherent change. Preserve authorship, sourcing, first-hand evidence, and clear disclosure when automation materially created content.

### 6. Verify

Run checks proportional to the change:

```bash
npm run seo:guard
npm run metadata:route-guard
npm run skills:validate
npm run agent -- verify --dry-run
```

Also render the affected URL at mobile and desktop widths, inspect source metadata and structured data, test links and the primary task, and confirm no private or low-sample graph data became public.

Passing a guard does not prove Google indexed or ranked a page.

### 7. Observe and learn

At the next comparable window:

- verify whether the change was actually deployed and crawled
- compare the pre-registered primary metric and guardrail
- note seasonality, brand demand, release changes, SERP changes, and small samples
- decide `keep`, `revise`, `revert`, or `inconclusive`
- append the result to `docs/growth/experiments.md`, the weekly review, and `docs/growth/learnings.md` when durable

Do not claim causality from a single noisy movement. If the result is inconclusive, retain the hypothesis and state what evidence is still needed.

## Output contract

End every pass with exactly one honest outcome:

1. `implemented`: one pre-registered change shipped locally and verified
2. `baseline`: measurement captured, with the next comparison window
3. `blocked`: the missing data, access, product truth, sample, or attribution named

Report the stable intervention ID, changed files, evidence date, checks run, and next measurement date. Never claim a ranking win before comparable post-change evidence exists.

## Boundaries

- No keyword stuffing, doorway pages, expired-domain abuse, scaled thin content, fake freshness, copied summaries, fabricated proof, or link spam.
- No mass publishing from keyword lists.
- No public aggregate below the repository's sample and privacy gates.
- No unsolicited changes outside the claimed intervention.
- No secret values in logs, reports, prompts, or committed files.
- No automatic deploy, merge, outreach, purchase, or account mutation.
