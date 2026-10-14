# Metrics

KPI definitions, dated snapshots, and the measurement framework. GSC and GA4
exports exist in `docs/growth/metrics/`; each JSON file's `fetchedAt` is the
source of truth for freshness. Values in this narrative are historical until
their date is stated and should not be presented as live.

## Verified reporting baseline, 2026-10-13

Read-only provider access is confirmed. The exact observation window is
2026-09-15 through 2026-10-12, inclusive, in GA's Africa/Casablanca timezone.
The aggregate-only receipt is
[reporting-access-2026-10-13.json](metrics/reporting-access-2026-10-13.json).

| Measure | Observed value | Meaning and limit |
|---|---|---|
| GA reported users | 45 | Provider-reported users, potentially missing unconsented activity |
| GA sessions | 48 | Provider sessions, distinct from the tab journey used for first-value joins |
| GA pageviews | 70 | Pageviews, not customer outcomes |
| GA engagement rate | 8.33% | Engaged sessions / sessions; no provider sampling or threshold restriction reported |
| GSC web impressions | 81 | Finalized property-level web-search data, not an indexing census |
| GSC web clicks | 5 | Search clicks, with no joined Site claim or revenue outcome |
| GSC web CTR | 6.17% | Property clicks / property impressions, not the returned-query subset |
| GSC average position | 3.27 | Impression-weighted average, not a current search rank |

This establishes access and a dated baseline. It does not establish growth,
conversion improvement, website quality, non-branded demand or channel revenue.
Older snapshots use different dates and, in some cases, different definitions.
Do not infer a trend from them without a comparable-window analysis.

## Customer value measurement

`loadCustomerValueReport` in `lib/analytics/improvement-value-query.ts` reads
retained private cycles in one repeatable-read, read-only transaction. It emits
aggregate metrics and limitations, never Site, audit, Flag or customer IDs.
The local inspector requires a loopback PostgreSQL `DATABASE_URL`:

```bash
node --import tsx scripts/growth/inspect-customer-value.ts 30
```

This command does not read production or persist a snapshot. A report is useful
only when its database contains real, authorized product evidence; synthetic
test results demonstrate behavior, not business performance.

| Measure | Definition |
|---|---|
| Cohort | Retained cycles created in the requested interval, excluding deleted Sites; at most 10,000 cycles, with larger reports refused |
| Generated, recommended, accepted, attempted | Distinct cycles with each recorded action by the cutoff; these independent counts are not a sequential funnel |
| Outcome issued | Distinct cycles with an issued result, including inconclusive results |
| Outcome distribution | Latest issued result per cycle by cutoff, including retries; unclassified results are counted separately. This supersedes the earlier first-result distribution |
| Improved | Cycles with a retained system-issued improvement event; not a self-report, ongoing recovery guarantee or independently replayed proof |
| Time to outcome | Attempt to the first issued result; invalid, reversed or future durations are excluded, with sample size reported |
| Estimated linked check cost / improved cycle | Unique recorded source, monitoring and event-referenced verification run estimates / improved cycles |
| Estimated verification cost / outcome cycle | Unique run estimates for all issued verification attempts, including retries / cycles with an issued outcome |
| Cost coverage | Distinct known audit references, estimates present/missing, unknown verification-reference count and sum of known estimates |
| Recommended, explicitly accepted and improved cycles / active Site | Observed proxy for customer value, not proof of impact; absent active-Site denominator yields null |
| Active Site | Non-deleted Site with a completed check in the same observation window |
| Site with a second cycle | Another cycle generated after a prior issued outcome; not human return or paid retention |

Missing, invalid, negative, conflicting, or later-recorded estimates are unknown,
not zero. Either cost ratio is withheld when its coverage is incomplete. Outcome
costs resolve the audit ID recorded on each event, never a later fix attempt's
current run pointer. These are check-cost estimates, not total financial COGS;
unlinked runs, infrastructure, support and acquisition costs are excluded.

The existing admin calculator receives these corrections. Its legacy cost
projection lacks event audit IDs, so it returns N/A until that projection is
updated. The admin workspace has another active writer; this change leaves that
writer's scope intact. The reusable read-only report supplies the complete
projection now. Historical reports cannot be reconstructed from current retained
records after deletion or later state changes.

### Anonymous analysis to initial repair

The same inspector now supports an exact-source acquisition cohort:

```bash
node --import tsx scripts/growth/inspect-customer-value.ts 30 acquisition
```

`loadAcquisitionValueCohort` reads existing server start/result/claim events,
initial source audits, Improvement cycles and immutable attempt references in
one read-only snapshot. It creates no events, tables or tracking requirements.
Each unit is an anonymous initial analysis, not a person, session or Site. Seeds,
follow-up analyses and signed-in starts are excluded. The cohort uses recorded
start timestamps, then observes each start for exactly seven days. Immature
starts are reported separately and do not enter stage shares. Missing mature
source audits stay in the denominator and withhold shares.

The report counts analyses with a useful-result receipt, qualifying claim
receipt, initial issue cycle, recorded fix attempt, issued verification result,
and independently issued improvement. Counts are independent evidence stages,
not successive conversion rates. Claim evidence requires the exact
`analysis_claimed:<auditId>` receipt, its matching owner and Site, the current
audit/owner/Site link and a receipt timestamp within the window. New successful
anonymous claims emit this idempotent private event after identity migration
commits. Telemetry failure does not roll back a claim, and already-owned retries
never create a fresh transition timestamp. Legacy Site-only receipts or current
ownership without exact evidence remain unclassified and withhold the claim
share. Deleted or mismatched owner links withhold all shares.

Repair evidence must use the exact initial audit, matching cycle/Flag occurrence
and attempt, and an independent completed run with coherent dates in the same
Site and owner. Only a system-issued `OUTCOME_ISSUED` receipt can establish an
improved result. An `IMPROVED` label alone, copied handoff, reported fix, unrelated
Site, later monitoring source or mutable attempt result cannot substitute.
Bookkeeping may follow the recorded attempt; its action time is not rewritten.
Malformed or missing verification lineage produces partial coverage and
withholds shares. Valid events after seven days are simply outside the window.

The export contains finite entry-surface categories and aggregate counts only,
never raw campaign labels, visitor keys, URLs, source IDs or customer content.
It measures retained product evidence and service-issued results, not new
detector accuracy, continuing recovery, customer impact, human retention or
revenue. It cannot reconstruct data deleted or changed since the action. No
production cohort has been established yet, and this operational report cannot
authorize public research. Subsequent issues from monitoring remain in the
general value report, outside this exact-initial-source attribution scope.

### Continuing Site value

```bash
node --import tsx scripts/growth/inspect-customer-value.ts 30 sites
```

`loadSiteValueCohort` uses the first retained exact analysis-claim receipt per
Site, determined before filtering the requested cohort interval. It observes
each mature Site for seven days in one read-only snapshot. A later receipt
cannot reset the cohort. This is not necessarily the first-ever claim or a new
customer; pre-existing Sites are counted separately.

Independent Site counts cover completed production scheduled checks, issue
cycles, recorded attempts, system-issued improvement, completed monitoring
requested after improvement, and owner-attributed WEB follow-up requested after
one day. Repair proof can use the initial or a later source audit. Completed
source and verification runs, exact occurrence and attempt links, coherent
dates, and current Site ownership are required. Validation runs are excluded.

A completed check after improvement does not prove that the fix stayed resolved.
Owner-attributed requests do not prove a human return or paid retention. These
independent stages are not a sequential funnel or channel attribution. Missing,
deleted or inconsistent links withhold shares. The report refuses evidence
above its 50,000-row limits, creates no records, and emits no private identifiers.
Only local synthetic SQL fixtures have been measured; no production Site cohort
or commercial outcome has been established.

### Commercial evidence boundary, 2026-10-13

Paid conversion and collected revenue remain unavailable. Subscription lifecycle
records retain plan prices and status, including trials. These do not establish
cash received. The new `BillingLedgerEntry` producer is concurrent billing work,
not part of the approved publication candidate or a verified production dataset.

Its current invoice writer stores `amount_paid`, currency, paid time, owner and
payment reference. It does not retain `livemode` or `paid_out_of_band`, and both
`invoice.paid` and `invoice.payment_succeeded` enter the same writer. Stripe
documents that [invoice.paid includes out-of-band settlement](https://docs.stripe.com/api/events/types)
and exposes [live-mode and out-of-band fields on the invoice](https://docs.stripe.com/api/invoices/object?api-version=2024-10-28.acacia).
Existing ledger rows therefore cannot alone prove live Stripe cash collection.
This finding does not establish that any production receipt was misclassified.

Before using that ledger for growth decisions, the billing owner should preserve
or validate live/test mode and settlement provenance for invoices and credit
payments, distinguish positive payments from zero-value settlements, and verify
deduplication and refund attribution per currency. Historical absence cannot
prove that an owner never paid; a first-payment cohort also needs explicit
history coverage. Provider-history reconciliation writes local ledger records
and must not be invoked as a read-only reporting step.

After the billing contract is ready, use an authorized aggregate-only snapshot
to join mature claim cohorts to exact owner payment receipts. Require complete
cohort windows and report coverage before interpreting a conversion share. No
new billing pipeline, provider import or production query was run for this
assessment, and existing admin billing work remains with its owner.

## Historical planning inventory

The undated tables below preserve earlier planning context. Their “Current”
values, “Tracked” claims and targets are not verified measurements. The dated
baseline and implemented definitions above supersede them. In particular,
returned GSC pages never establish indexed-page counts, graph volume never
authorizes public research, and independent GA/DB totals never establish
stage-to-stage conversion or organic revenue.

## Measurement framework

The growth system measures four layers, each feeding the next:

```
Layer 1: Data quality (are we collecting the right signals?)
Layer 2: Intelligence quality (are rollups and scores accurate?)
Layer 3: Surface performance (are public pages earning traffic?)
Layer 4: Business outcomes (is traffic converting to revenue?)
```

### Layer 1: Data quality

| Metric | Definition | Source | Current | Target |
|---|---|---|---|---|
| Graph sites | `Site.count()` | `getGraphStats()` | 1 | 100+ |
| Graph pages | `Page.count()` | `getGraphStats()` | 1 | 500+ |
| Graph issues | `Issue.count()` | `getGraphStats()` | 1 | 50+ |
| Graph occurrences | `IssueOccurrence.count()` | `getGraphStats()` | 1 | 1000+ |
| Issues ≥ MIN_SAMPLE_SIZE | `Issue.count({ where: { siteCount: { gte: 20 } } })` | direct query | 0 | 10+ |
| Audit → graph persist success rate | Successful persists / completed audits | `GrowthArtifact` logs | 100% | 99%+ |
| Rollup freshness | Hours since last `issue-frequencies.ts` run | Scheduler logs | <6h | <6h |

### Layer 2: Intelligence quality

| Metric | Definition | Source | Current | Target |
|---|---|---|---|---|
| Benchmark snapshots | `BenchmarkSnapshot.count()` | direct query | 0 | 20+ |
| Opportunity scores computed | Count of scored opportunities | `opportunity-scoring.ts` output | 0 | 50+ |
| Weekly reviews generated | Count of `weekly-review/*.md` files | file count | 1 (manual) | 4+ (automated) |
| Competitive intel freshness | Days since last `competitors.md` update | file mtime | N/A | <30 |

### Layer 3: Surface performance (organic)

| Metric | Definition | Source | Current | Target |
|---|---|---|---|---|
| Impressions | Search impressions across all indexed URLs | GSC | 63 (last 28d) | Growing weekly |
| Clicks | Search clicks | GSC | 3 (last 28d) | Growing weekly |
| Avg. position | Mean SERP position for tracked queries | GSC | ~3.0 | <20 for target queries |
| Indexed pages | Count of URLs Google has indexed | GSC Coverage | 2 (www vs non-www) | All intended pages |
| Branded search share | % of clicks from queries containing "fixflags" | GSC | 100% (only branded queries so far) | <30% (healthy non-branded mix) |
| Referring domains | Distinct domains linking to fixflags.com | Backlink tool | Not yet available | Growing monthly |
| CTR by page type | Clicks / impressions per page family | GSC | 4.8% (homepage) | >3% for issue pages |
| Issue page impressions | Impressions for `/issues/*` URLs | GSC | N/A (not yet built) | >1000/mo within 90 days of indexing |
| Free tool usage | `ToolUsage.count()` per tool | DB | 0 | 100+/mo per tool |
| Free tool → audit conversion | Tool sessions that start an audit | `ToolUsage.sessionId` correlation | N/A | >15% |

### Layer 4: Business outcomes

| Metric | Definition | Source | Current | Target |
|---|---|---|---|---|
| Users | Total users | GA4 | 129 (last 28d) | Growing from organic |
| Sessions | Total sessions | GA4 | 179 (last 28d) | Growing from organic |
| Page views | Total page views | GA4 | 683 (last 28d) | Growing from organic |
| Engagement rate | Engaged sessions / total | GA4 | 48.6% | >60% |
| Audit starts | Count of `started_audit` events | GA4 | 17 (last 28d) | Growing from organic |
| Audit completion rate | completed / started | GA4 + DB | 17.6% (3/17) | >80% |
| Signups | Count of `signed_up` events | GA4 | Tracked | Growing from organic |
| Paid conversion | Count of `completed_checkout` | GA4 + Stripe | Tracked | >5% of signups |
| Revenue from organic | Stripe revenue attributed to organic source | DB + Stripe | Not computed | Growing monthly |
| Organic attribution | Which surfaces drive signups/paid | UTM + source tracking | Not implemented | Measurable per surface |
| Cost per organic acquisition | Total growth cost / organic signups | Manual | N/A | Declining over time |

### Funnel metrics (the core loop)

The most important metrics are the ones that measure the loop:

```
Organic visitor → Tool result → Audit start → Audit complete → Signup → Paid
```

| Funnel stage | Metric | Source |
|---|---|---|
| Visitor → Tool use | Tool usage count | `ToolUsage` |
| Tool use → Audit start | Attribution via UTM/source | `Audit.source` |
| Audit start → Complete | Completion rate | `Audit.status` |
| Complete → Signup | Signup rate | `Audit.userId` (null = anon) |
| Signup → Paid | Conversion rate | `User.subscriptionStatus` |
| Paid → Revenue | ARPU | `Stripe` |

## How to update this file

1. **Each SEO loop:** Pull matching GSC and GA4 windows when credentials are
   authorized, then record their `fetchedAt`, segments, and caveats in the
   weekly review.
2. **Weekly:** Refresh narrative values only from attributable exports. Keep
   GSC average position labeled as impression-weighted, not an exact rank.
3. **Monthly:** Review target vs. actual, adjust targets based on trajectory.
