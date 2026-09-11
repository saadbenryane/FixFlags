# Paid packaging uses the waitlist, not /request-demo

**Date:** 2026-09-09
**Scope:** pricing, billing CTAs, waitlist
**Confidence:** HIGH
**Evidence:** `/pricing` Pro card, PlanPicker, UpgradeButton, and `pickPlan` gated/paid-closed/batch branches all go to `/waitlist/pro` or `/waitlist/studio`.

`/demo` remains the DemoSite fixture. `/request-demo` may remain as a URL and still emails Saad; it is not the public Pro CTA. Paid intent while Stripe is closed is Join waitlist. Public list is `$49`/website/mo (Free weekly, Pro daily). Do not reopen `STRIPE_PAID_OPEN` in a packaging pass. Live Stripe IDs stay `$39`/`$129` until an explicit checkout pass creates a `$49` price.

Prevention: `lib/billing/waitlist-path.ts`, pricing parity tests, pick-plan tests, PricingCTAButton gated click.
