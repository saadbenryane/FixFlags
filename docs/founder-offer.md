# Retired Founder Discount (historical)

## Status

The 40% Founder Discount is **retired** as of 2026-08-04.

Current shipping discount model is launch-tier based:
- first 500 waitlist positions per paid plan: 25% off for 12 months,
- next 500 waitlist positions per paid plan: 15% off for 12 months.

See:
- [stripe-setup.md](./stripe-setup.md)
- [../lib/billing/discount-tiers.ts](../lib/billing/discount-tiers.ts)
- [DECISIONS.md](../DECISIONS.md) (2026-08-04)

## Why kept as historical

This document preserves campaign context created before the launch-tier model was finalized.
It is historical reference only and should not be treated as operational policy.

## Historical mechanics (do not apply)

- 40% discount,
- 12 month duration,
- plan-scoped coupons in Stripe,
- `FOUNDER40` / `FOUNDERSTUDIO40` offer codes.

Those references are useful for archive/audit context only.

## Operational migration rule

If any code or docs reference `founder_offer` / `founder_40_12m` values,
replace them with:
- `discountTier` (`1`/`2`/`null`),
- campaign batch/access fields in waitlist rows,
- tier-specific launch promotion IDs from `discount-tiers.ts`.
