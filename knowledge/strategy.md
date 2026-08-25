# Pricing and Revenue

**Canonical home for FixFlags pricing philosophy, tier structure, revenue model, and unit economics.**

## Pricing

| Tier | Plan enum | Price | Product reviews |
|------|-----------|-------|-----------------|
| Free | `FREE` | $0 | 3/month |
| Pro | `BUILDER` | $29/month | 15/month |
| Studio | `TEAM` | $79/month | 50/month |

Display name **Studio** maps to the existing `TEAM` enum.
Enforcement lives in `lib/billing/plans.ts` and `lib/audit/usage.ts`.

## Packaging principle

Every Product Review includes prioritized Flags, evidence, and fix prompts.
The plans form a workflow ladder: Free proves the loop on one Product, Pro supports repeated releases across up to five Products, and Studio adds scheduling and workspace collaboration for unlimited Products.

New URLs, update reviews, and completed scheduled Watch reviews consume the same product review allowance.
Unused monthly allowance does not roll over.
Existing purchased overflow credits remain compatible but are not promoted.

## Upgrade logic

- **Free:** three monthly reviews for one Product.
- **Pro:** fifteen monthly reviews across up to five Products, with history across releases and release comparison.
- **Studio:** fifty monthly reviews across unlimited Products, scheduled reviews, shared Product history, and workspace invitations.
- **Studio launch offer:** unlimited workspace seats for a limited time.
- **High volume:** handled through a direct conversation after the Studio allowance is demonstrably insufficient.

An upgrade adds capacity and workflow leverage, never a more trustworthy report.

## Revenue model

- Monthly Pro and Studio subscriptions.
- Existing overflow-credit balances remain usable.
- Annual billing waits until retention evidence supports it.
- Power-user tooling is parked and is not part of the current revenue promise.

## Unit economics

- Deterministic checks run before expensive AI work.
- Product Review admission is bounded by an explicit monthly allowance.
- Scheduled Watch pauses when no product review allowance remains.
- Gross-margin reporting must include browser, model, storage, queue, and support costs.
- Target gross margin remains above 80% across paid usage.

Near-term operating assumptions live in [docs/year-1-operating-plan.md](../docs/year-1-operating-plan.md).
