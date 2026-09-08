# SEO opportunity playbook

Use this reference after measuring the current state. These are candidate mechanisms, not an automatic backlog.

## Existing-result opportunities

### Striking distance

Signal:

- sustained impressions
- impression-weighted average position roughly 4 to 20
- a page that substantially serves the query already

Investigate intent fit, missing first-hand evidence, weak section coverage, internal links, and current result formats. Do not add unrelated text merely to include terms.

### High impressions, weak CTR

Confirm the ranking range, query mix, device, brand/non-brand split, and the title Google actually shows. A title or description change is justified only when the snippet undersells or misstates the page's real value.

### Decay

Compare equivalent windows and inspect:

- whether the page was changed, redirected, de-indexed, or canonicalized elsewhere
- whether competitors or SERP features changed
- whether demand or intent shifted
- whether the page became stale or less useful
- whether important internal links disappeared

Do not label ordinary low-volume variance as decay.

### Cannibalization

Use query plus page data. Multiple URLs receiving impressions for one query is a clue, not proof. Determine whether they serve the same intent before consolidating. When consolidating, preserve useful distinctions, redirect retired URLs, align canonicals, and repair internal links.

## Technical opportunities

Prioritize defects that prevent a valuable page from being discovered or understood:

- accidental `noindex`, robots exclusion, or authentication
- wrong canonical, redirect chain, soft 404, or duplicate URL
- missing sitemap entry for a canonical indexable page
- server/render failure for crawler-accessible HTML
- title, heading, and visible-content disagreement
- invalid or misleading structured data
- broken internal links or orphaned pages
- page experience problems that materially harm users

Technical correctness cannot make an unhelpful page rank.

## FixFlags-native creative mechanisms

Prefer assets competitors cannot cheaply reproduce:

### Evidence-backed issue answers

Use anonymized, sample-gated Flag evidence to explain:

- what the issue looks like
- which Outcome it threatens
- how FixFlags observed it
- how to fix it
- what fresh verification must prove

### Original research

Aggregate only through approved graph queries and privacy/sample gates. Publish methodology, scope, dates, limitations, and what the evidence does not prove. A smaller honest study beats a broad unsupported claim.

### Useful diagnostics

Build a focused tool when the visitor can complete a real task immediately. The result should naturally lead to a deeper Site analysis without withholding the promised utility.

### Outcome-led guides

Organize around customer tasks such as making contact, completing checkout, understanding an offer, or trusting a site. Connect technical details to observable behavior and verification.

### Verification stories

Show controlled broken-to-fixed examples with independent recapture. Never imply that absence of a Flag alone proves recovery.

### Data-informed internal links

Link pages when the next page answers a genuine follow-up question. Use descriptive anchors. Avoid sitewide keyword-heavy link blocks.

### Consolidation and pruning

Removing, merging, or de-indexing weak duplication can improve the information architecture. Preserve redirects and historical value where appropriate.

## Candidate scorecard

Score each candidate from 0 to 3:

- qualified demand: measured evidence that the intended audience searches for it
- intent fit: ability to satisfy the query's actual task
- information gain: unique evidence, utility, or analysis
- product fit: likelihood of leading naturally to useful FixFlags action
- confidence: strength and freshness of the evidence
- effort: implementation and maintenance cost
- risk: spam, privacy, product-truth, index-bloat, or regression exposure

Use:

`priority = (demand + intent + information gain + product fit + confidence) - effort - risk`

The score orders judgment; it does not replace it. Record why the winner is better than the strongest rejected candidate.

## Experiment timing

Choose the observation window before editing:

- crawl/index repairs: inspect after Google recrawls; ranking impact may take longer
- title/description tests: wait for recrawl and a meaningful impression sample
- content changes: compare at least one equivalent demand cycle where practical
- new pages: baseline indexing and impressions first; conversion conclusions need enough sessions

If the window ends without enough evidence, mark `inconclusive`. Do not move the goalposts after seeing the result.

## Business guardrails

Pair the primary search metric with at least one:

- qualified organic landing sessions
- Site analysis starts
- useful result completion
- account claim of the same Site
- Flag detail engagement
- Fix or Verify action
- monitoring adoption

Use current event and persistence contracts. If attribution cannot connect the stages, state that limitation rather than constructing a synthetic funnel.
