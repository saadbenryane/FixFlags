# FixFlags Year 1 Operating Plan

## Purpose

This document defines the operating targets for FixFlags during its first year. These numbers are planning assumptions, not guarantees. They are intended to align product, engineering, marketing, and business decisions around a shared definition of success.

## North Star

Reach $50,000 MRR within 12 months while building a profitable, capital-efficient company.

Success is measured by recurring revenue, customer value, and product adoption rather than feature count.

## Year 1 Financial Targets

| Metric | Target |
|---|---|
| Exit MRR | $50,000–60,000 |
| Exit ARR | ~$600,000–720,000 |
| Year 1 Recognized Revenue | $180,000–220,000 |
| Gross Margin | >80% |
| Operating Costs | <$90,000 |
| Net Before Founder Salary & Taxes | ~$100,000–140,000 |

## Customer Targets

> **Tier names below match the live product** (`lib/billing/plans.ts`): `Free` ($0, not a paying tier), `Pro` ($29/mo), `Max` ($99/mo). There is no "Builder" or "Studio" tier in the schema — this section previously referenced names that don't exist in the product and has been corrected.

End of Year 1:

- 600+ paying customers (Free excluded — it's the funnel entry point, not revenue)

Suggested customer mix (funnel-shaped, Pro as the primary paid tier):

- ~500 Pro
- ~80–100 Max

Monthly churn target:

- Less than 5%

> **Open math gap — flagging, not resolving:** at current pricing, 500 Pro + 100 Max = **~$24,400 MRR**, roughly half the $50,000–60,000 Exit MRR target in the North Star above. Closing this gap requires one of: (a) a materially larger paying-customer count (~1,250–1,500 at today's Pro/Max blend to reach $50k), (b) a price increase on Pro/Max, or (c) a new higher-priced tier (e.g. an agency/team tier above Max). This is a pricing/GTM decision for the founder, not something this doc resolves on its own — the 600-customer and $50–60k MRR targets as currently stated are not simultaneously achievable under today's $29/$99 pricing.

## Growth Funnel Targets

By Month 12:

- 20,000 monthly website visitors
- 1,600 monthly signups
- 1,200 users complete their first audit
- 100–120 new paying customers each month
- Visitor → Signup: ~8%
- Signup → Paid: ~7%
- First Audit Completion: >75%

## Product Success Metrics

Year 1 goals:

- 50,000 audits completed
- 500,000 flags generated
- 150,000 fix prompts copied
- Average audit duration under 30 seconds
- Audit success rate above 85%

The objective is to become part of a builder's normal development workflow.

## Product Priorities

Priority order:

1. Deliver excellent audits.
2. Produce high-quality fix prompts.
3. Improve audit speed.
4. Increase trust through evidence and screenshots.
5. Introduce repository-connected fixes.
6. Expand collaboration and team workflows.

Avoid building features that do not improve activation, retention, or revenue.

> **Sequencing note:** Priority 5 (repository-connected fixes) is already substantially built — see `docs/scan-roadmap.md` and `docs/offering.md` for current status. Priority 6 (team/collaboration workflows) is intentionally deferred behind the 100-paying-user feature gate documented in `docs/offering.md`, expected around Q2 per the quarterly milestones above. This is a scheduled decision, not an oversight — revisit it once the gate clears rather than building it opportunistically.

## Marketing Targets

Year 1:

- 100 LinkedIn posts
- 50 X posts
- 25 SEO articles
- 10 coding livestreams
- 50 public website audits
- Product Hunt launch
- Hacker News launch
- Guest appearances on podcasts, newsletters, or communities

The objective is to build a repeatable distribution engine rather than rely on a single launch.

## Sales Targets

Year 1:

- 100 agency conversations
- 30 agency trials
- 10 paying agencies
- 5 long-term design partners

Agencies are a strategic acquisition channel because they repeatedly audit client websites.

## Team Plan

Remain lean.

Expected team by the end of Year 1:

- Founder
- 1 engineer
- 1 growth/marketing hire
- Part-time customer support

Use AI and contractors before making permanent hires.

## Weekly KPI Dashboard

Review every week:

**Revenue**

- MRR
- New MRR
- Expansion MRR
- Churned MRR

**Customers**

- New customers
- Active customers
- Churn rate
- Trial-to-paid conversion

**Product**

- Audits completed
- Audit success rate
- Average audit duration
- Fix prompts generated
- Fix prompts copied

**Growth**

- Website visitors
- Signup rate
- Activation rate
- Paid conversion rate
- Organic traffic
- Referral traffic

## Quarterly Milestones

**End of Q1**

- 25+ paying customers
- Core onboarding validated
- Product-market fit signals emerging

**End of Q2**

- 125–150 paying customers
- Repeat usage established
- First agency customers

**End of Q3**

- 325–375 paying customers
- Sustainable organic acquisition
- Strong public case studies

**End of Q4**

- 600+ paying customers
- $50k+ MRR *(see the open math gap noted under Customer Targets — hitting both simultaneously at current pricing is not yet reconciled)*
- Profitable or near-profitable
- Clear roadmap toward $2M+ ARR in Year 2

## Decision Principles

When making product decisions, prioritize work that improves one or more of the following:

- Acquisition
- Activation
- Conversion
- Retention
- Revenue
- Audit quality
- Customer trust
- Speed
- Ease of use

Avoid shipping features that do not materially improve these outcomes.

## Operating Philosophy

FixFlags exists to become the default QA layer for AI-built products.

Every decision should move the product toward being:

- Faster than manual QA
- More actionable than traditional audits
- Trusted by founders and developers
- Easy to adopt within existing AI coding workflows
- A product users return to every time they ship

When trade-offs arise, optimize for long-term customer value, simplicity, and sustainable recurring revenue rather than short-term feature velocity.
