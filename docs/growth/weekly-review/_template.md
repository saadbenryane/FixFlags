# Weekly SEO growth review template

Copy this file to `YYYY-Www.md` for each ISO week. Keep prior reviews
immutable. Correct an error with a dated note instead of rewriting history.

## Week of [start date] to [end date]

### Run context

- **Run date:**
- **Comparison windows:** [current range] vs. [equivalent prior range]
- **Segments:** [country, device, search type, brand/non-brand, if filtered]
- **Data freshness:** [GSC, GA4, crawl/index, graph, observed SERP]
- **Prior intervention:** [stable ID or none]

GSC position below means impression-weighted average position, not an exact
live rank. Timestamp manual SERP observations and keep them separate.

### Measure

- **Search Console:** [clicks, impressions, CTR, average position, page/query movement]
- **Analytics:** [qualified organic landings and relevant Site-loop events]
- **Crawl and index:** [robots, sitemap, canonical, inspection, rich-result changes]
- **Observed SERP:** [query, locale/device, timestamp, notable result or feature changes]
- **Knowledge graph:** [only current, sample-gated figures from canonical queries]
- **Data caveats:** [small sample, missing rows, partial period, attribution gaps]

### Ranking briefing

- **Phase:** [foundation / useful capture / authority]
- **Brand vs non-brand:** [query clicks/impressions split, dated]
- **Keyword map:** [jobs with measured or sampled queries, and the FixFlags page that should serve them]
- **SERP competition:** [query, locale/device, timestamp, who occupies the job, what FixFlags uniquely adds]
- **Why not a generic category term this cycle:**

### Did the prior change work?

- **Intervention ID:**
- **Applied and deployed:** [yes/no/partial, with evidence]
- **Recrawled or reprocessed:** [yes/no/unknown]
- **Primary metric result:** [baseline -> result]
- **Business guardrail result:** [baseline -> result]
- **Confounders:**
- **Decision:** [keep/revise/revert/inconclusive]
- **Reason:**

### Candidate opportunities

List candidates from different mechanisms, then choose one.

| Candidate | Evidence | Intended visitor task | Expected mechanism | Confidence | Effort/risk |
| --- | --- | --- | --- | --- | --- |
| [candidate] | [dated source] | [task] | [why it could work] | [low/medium/high] | [summary] |

### This cycle's intervention

- **Stable ID:** `SEO-[TYPE]-[NNN]`
- **Target query/page:**
- **Audience and intent:**
- **Dated baseline:**
- **Exact change:**
- **Expected causal mechanism:**
- **Primary search metric:**
- **Product/business guardrail:**
- **Observation window and next measurement date:**
- **Keep/revise/revert rule:**
- **Why this beat the strongest alternative:**

### Implementation and verification

- **Changed files or blocker:**
- **Rendered behavior checked:**
- **SEO and metadata guards:**
- **Focused tests:**
- **Deployment state:** [local only/deployed, with evidence]

### Cycle outcome

Choose exactly one:

- [ ] `implemented`: one pre-registered intervention is locally complete and verified
- [ ] `baseline`: measurement captured; no justified change yet
- [ ] `blocked`: missing data, access, product truth, sample, or attribution named

### Durable updates

- [ ] `experiments.md` pre-registration or result appended
- [ ] `growth-memory.md` digest appended when the cycle changes direction
- [ ] `metrics.md` refreshed only from attributable data
- [ ] `backlog.md` re-ranked when new evidence changes priority
- [ ] `decision-log.md` updated for a durable decision
- [ ] `learnings.md` updated for a validated, reusable learning
