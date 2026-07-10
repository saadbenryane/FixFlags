# Metrics

KPI definitions, current values, and the measurement framework. Updated weekly
once analytics access and the rollup job are live. Until then, this file
defines what we'll measure and why — not live numbers.

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

1. **Weekly (automated once `weekly-review.ts` exists):** Graph stats and
   surface performance numbers are pulled automatically.
2. **Weekly (manual until analytics access):** Fill in GSC/analytics rows
   once access is granted.
3. **Monthly:** Review target vs. actual, adjust targets based on trajectory.
