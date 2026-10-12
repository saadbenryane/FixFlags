---
status: supporting
authority: product
reviewed_at: 2026-10-10
supersedes: []
---

# FixFlags business model

The accepted commercial direction is one Site product, sold per website. [Business and plan strategy](../knowledge/strategy.md) owns the rationale, [the product masterplan](product-masterplan.md) owns the launch gate, and `lib/billing/plans.ts` owns implemented plan behavior.

## Public packaging

Open beta currently includes all supported features, custom scheduling, and unrestricted commercial usage on one website. The paid offers below are planned and remain on the waitlist.

| Plan | Price | Website relationship |
| --- | --- | --- |
| Free | $0 | Uptime monitoring; full supported access on one website during open beta |
| Pro | Planned $49 per website per month | 30 website checks per month, scheduled or manual |
| Studio | Planned $99 per website per month | 90 website checks per month, with planned checks after published updates |

Both paid plans include custom automatic scheduling. One website check is a bounded run of the available FixFlags suite across configured coverage. Scheduled, manual, and Studio integration-triggered checks use the same allowance. Uptime monitoring runs separately on its configured schedule and must continue when the complete-check allowance is exhausted. Studio update triggers require a supported repository or deployment integration and remain planned.

Paid checkout is closed. Pro and Studio calls to action join the waitlist. Stripe must remain closed until the per-Site cost baseline and complete test-mode checkout evidence close blocker B5 in the product masterplan.

Internal plan identifiers remain `FREE`, `BUILDER`, and `TEAM`. Internal 3/30/90 review pools and legacy deep-review fields are compatibility and enforcement details, not customer packaging. Existing subscribers and price-bound allowances must be migrated explicitly, never silently repriced or downgraded.

## What the customer buys

FixFlags looks after a website and the journeys the business depends on:

- broad live analysis that produces evidence-backed Flags;
- a clear Fix handoff without pretending work is complete;
- fresh, relevant verification after a change is published;
- ongoing Watch at the plan's honest cadence;
- connections that enrich the same Site instead of creating another product.

Plans change the monthly website-check allowance and available triggers, not evidence standards. The allowance counts website runs, not individual technical checks. Do not promise unrestricted page counts, unlimited Sites, continuous detection, an SLA, or unshipped integrations as available features.

## Economics gate

The target paid cost envelope is approximately $12 per Site per month at the $49 list price. Measure real `auditRunCost` for Watch and Analyze before paid launch. If bounded daily verification cannot stay inside that envelope, reduce the verification scope or keep checkout closed. Do not weaken evidence or overstate monitoring to preserve a price.

## Parked products

Repository scanning, deployment hooks, and the old Product Review / Finish Plan product model are not customer offers. MCP, API keys, and the CLI bridge are now Site/Outcome access paths included with the account, not paid review-credit products. They must not be marketed as production-proven until the exact-client canary gate passes. Paid checkout remains closed.
