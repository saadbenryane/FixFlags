# Business and plan strategy

**TARGET direction from the September 8 vision.** Existing billing and plans are reusable infrastructure. Current prices, identifiers, quotas and checkout behavior are owned by lib/billing/, lib/auth/entitlements.ts and their tests; this document does not silently change customer entitlements.

## Free relationship

A URL gives useful understanding before installation and ideally before account creation. Keeping the Site creates the relationship and provides enough real ongoing monitoring to demonstrate care. The free product is not merely a static report or a signup teaser.

Observation should increase usefulness at sustainable cost. Avoid treating installation itself as an immediate paywall trigger. Bounded abuse protection, collection limits and transparent retention are compatible with meaningful free value.

## Paid responsibility

Paid plans deepen how much responsibility FixFlags takes: checking frequency, page and Outcome coverage, verification depth, history, observation scale, useful premium context, alert speed, Sites, collaboration and agent workflows. The same underlying evidence standards apply at every tier.

The public list is **per website**, not unlimited Sites and not a checks-per-month bundle. Free is one website, verified weekly. Paid is `$49` per website per month, verified every day. Studio is the same product for several websites, billed per website, quoted on the waitlist. Stripe IDs and live subscriber allowances do not change until an explicit checkout pass. `STRIPE_PAID_OPEN` stays false while paid intent goes through the waitlist.

True full Playwright + judge every hour will not profit at `$49`/site. Sell one sentence, run two jobs: a cheap **pulse** (up, important URL still loads) between verifications, and a bounded **verification** (browser journeys, Flags, evidence) weekly on Free and daily on Pro, scoped to inferred journeys. Do not claim a full Flag audit every hour. Do not print page counts.

Paid COGS envelope is about `$12` per site per month (~75% gross at `$49`). Pulse is cents. Daily verification must stay bounded. Measure `auditRunCost` p50 for Watch vs Analyze before flipping `STRIPE_PAID_OPEN`. If p50 daily COGS exceeds `$12`, thin the verification or do not open Stripe at `$49`. Create a new Stripe `$49` price at that pass. Do not silently reprice `$39`/`$129` subscribers. Unlimited Sites is rejected.

Do not invent new prices, quotas or SLAs from vision examples. Keep existing billing infrastructure and accounts. Before Phase 4 release, measure per-Site execution/collection cost, define the minimum useful free responsibility and paid limits, and reconcile recurring scheduling with budget enforcement. Before migration, map legacy subscribers and usage explicitly without silent downgrade or double billing.

## Distribution and positioning

One product with URL-first discovery, useful Flag sharing, agent handoffs, agency/client loops and continued care. Shopify is the first focused commerce wedge and a native installation route into the same Site. It is not a second company-wide product architecture.

Phase order and pending commercial decisions live in [ROADMAP.md](../ROADMAP.md). Claiming adoption, uplift or revenue saved requires actual evidence.
