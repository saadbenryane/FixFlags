# Pricing and Revenue

**Canonical home for FixFlags pricing philosophy, tier structure, revenue model, and unit economics.**

## Pricing

| Tier | Plan enum | Price | Product reviews | Deep reviews |
|------|-----------|-------|-----------------|--------------|
| Free | `FREE` | $0 | 3/month | 1/month |
| Pro | `BUILDER` | $29/month | 15/month | 3/month |
| Studio | `TEAM` | $79/month | 50/month | 10/month |

Display name **Studio** maps to the existing `TEAM` enum.
Enforcement lives in `lib/billing/plans.ts` and `lib/audit/usage.ts`.

## Packaging principle

Every plan includes the same complete web product: reports, evidence, fix prompts, update comparisons, history, protected sharing, Canvas, Product Signals, and scheduled Watch.
Plans differ by monthly usage, not access to the core loop.

New URLs, update reviews, and completed scheduled Watch reviews consume the same product review allowance.
Deep reviews use a separate monthly allowance because they have a different execution cost.
Unused monthly allowance does not roll over.
Existing purchased overflow credits remain compatible but are not promoted.

## Upgrade logic

- **Free:** proves value and supports occasional shipping.
- **Pro:** fits a builder who ships frequently.
- **Studio:** fits agencies, studios, and teams reviewing multiple products.
- **High volume:** handled through a direct conversation after the Studio allowance is demonstrably insufficient.

An upgrade buys more capacity, never a more complete report or a more trustworthy verification result.

## Revenue model

- Monthly Pro and Studio subscriptions.
- Existing overflow-credit balances remain usable.
- Annual billing waits until retention evidence supports it.
- Power-user tooling is parked and is not part of the current revenue promise.

## Unit economics

- Deterministic checks run before expensive AI work.
- Review and deep-review admission are bounded by explicit monthly allowances.
- Scheduled Watch pauses when no product review allowance remains.
- Gross-margin reporting must include browser, model, storage, queue, and support costs.
- Target gross margin remains above 80% across paid usage.

Near-term operating assumptions live in [docs/year-1-operating-plan.md](../docs/year-1-operating-plan.md).
