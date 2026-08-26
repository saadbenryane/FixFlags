# Pricing and Revenue

**Canonical home for FixFlags pricing philosophy, tier structure, revenue model, and unit economics.**

## Pricing

| Tier | Plan enum | Price | Product reviews |
|------|-----------|-------|-----------------|
| Free | `FREE` | $0 | 3/month |
| Pro | `BUILDER` | $29/month | 30/month |
| Studio | `TEAM` | $79/month | 90/month |

Display name **Studio** maps to the existing `TEAM` enum.
Enforcement lives in `lib/billing/plans.ts` and `lib/audit/usage.ts`.

## Packaging principle

Every Product Review includes prioritized Flags, evidence, and fix prompts.
Plans add how far a public review goes as well as monthly volume and workflow: Free reviews this page and checks every public link, Pro also reviews the pages that page links to, and Studio reviews one level beyond.
Judgment quality per reviewed page stays the same.
An upgrade buys more of the Product, not better intelligence.

New URLs, update reviews, and completed scheduled Watch reviews consume the same product review allowance.
Unused monthly allowance does not roll over.
Existing purchased overflow credits remain compatible but are not promoted.

## Upgrade logic

- **Free:** three monthly reviews for one Product. Each review covers this page and checks every public link.
- **Pro:** thirty monthly reviews across up to five Products, with history across releases, release comparison, and review of the pages the pasted page links to.
- **Studio:** ninety monthly reviews across unlimited Products, scheduled reviews, shared Product history, workspace invitations, and one level beyond the linked pages.
- **Studio launch offer:** unlimited workspace seats for a limited time.
- **High volume:** handled through a direct conversation after the Studio allowance is demonstrably insufficient.

An upgrade adds capacity, how far a public review goes, and workflow leverage.
Judgment quality on every page FixFlags claims to have reviewed stays the same.

## Revenue model

- Monthly Pro and Studio subscriptions.
- Existing overflow-credit balances remain usable.
- Annual billing waits until retention evidence supports it.
- Power-user tooling is parked and is not part of the current shipped product.
Logged-in review on your computer is a waitlisted Pro and Studio offer (NEXT), not a shipped capability.

## Unit economics

- Deterministic checks run before expensive AI work.
- Product Review admission is bounded by an explicit monthly allowance.
- Scheduled Watch pauses when no product review allowance remains.
- Gross-margin reporting must include browser, model, storage, queue, and support costs.
- Target gross margin remains above 80% across paid usage.

Near-term operating assumptions live in [docs/year-1-operating-plan.md](../docs/year-1-operating-plan.md).
