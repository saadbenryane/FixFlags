---
status: canonical
authority: product
reviewed_at: 2026-10-10
supersedes: []
---

# Business and plan strategy

**TARGET direction from the accepted September 21 vision.** Existing billing and plans are reusable infrastructure. Current prices, identifiers, quotas and checkout behavior are owned by lib/billing/, lib/auth/entitlements.ts and their tests; this document does not silently change customer entitlements.

## Free relationship

**Founder direction, October 11:** offer the full supported product free during open beta on one website, with any supported monitoring schedule and no commercial usage quotas. Learn from unrestricted actual use rather than imposing a promotional spend budget. Keep account ownership, explicit protected-action authorization, execution deadlines, and concurrency safeguards. Retain a useful Free plan after beta and communicate changes before the temporary promotion ends. Paid access remains on the waitlist.

A URL gives useful understanding before installation and ideally before account creation. Keeping the Site creates the relationship and provides enough real ongoing monitoring to demonstrate care. The free product is not merely a static report or a signup teaser.

Observation should increase usefulness at sustainable cost. Avoid treating installation itself as an immediate paywall trigger. Bounded abuse protection, collection limits and transparent retention are compatible with meaningful free value.

## Paid responsibility

Paid plans deepen how much responsibility FixFlags takes: checking frequency, page and Outcome coverage, verification depth, history, observation scale, useful premium context, alert speed, Sites, collaboration and agent workflows. The same underlying evidence standards apply at every tier.

**Founder direction, October 12:** sell included uptime monitoring plus a monthly allowance of complete website checks per website. Pro proposes $49 per website per month for 30 checks; Studio proposes $99 for 90 checks. Scheduled and manual checks share one allowance. Both paid plans support custom automatic scheduling. Uptime runs separately on its configured schedule and must remain available when the complete-check allowance is exhausted.

One website check is one bounded run of the available FixFlags suite across configured coverage. Do not describe it as only browser verification, a charge for each internal check, or unrestricted crawling of every page. Custom scheduling changes when checks run, not their monthly allowance. Thirty checks is an allowance, not a promise of a check every day in every calendar month.

Studio additionally proposes checks after published website changes through a supported repository or deployment integration. These triggers use the same 90-check allowance and require an explicit integration setup. A repository push alone does not establish that the live website changed. This automation remains planned and must not be presented as shipped.

During open beta, all supported features, custom schedules, and unrestricted commercial usage remain available on one website. New paid access stays on the waitlist. The explicit beta policy keeps checkout closed even if old paid-opening flags are set. Stored subscriber prices and allowances remain independent of the promotion. A waitlist entry records interest and does not add a website, start a subscription, or charge the user.

These are planned offers, not live purchases or validated willingness to pay. Before paid launch, enforce the shared allowance across manual, scheduled, and integration-triggered runs without charging uptime against it. Keep a bounded execution scope, independent evidence standards, ownership checks, and execution deadlines. Preserve the existing waitlist discount commitments and migrate legacy subscribers explicitly without silent repricing or downgrade.

Measure real per-Site execution cost before opening checkout. The existing target for Pro is about $12 per Site per month at $49. Studio's three-times check allowance needs its own cost validation at $99. Do not weaken evidence to fit a margin target, promise continuous detection or an SLA, or launch paid access before the execution, quota, and billing gates are complete.


## Distribution and positioning

One product with URL-first discovery, useful Flag sharing, agent handoffs, agency/client loops and continued care. Shopify is the first focused commerce wedge and a native installation route into the same Site. It is not a second company-wide product architecture.

Phase order and pending commercial decisions live in [ROADMAP.md](../ROADMAP.md). Claiming adoption, uplift or revenue saved requires actual evidence.
