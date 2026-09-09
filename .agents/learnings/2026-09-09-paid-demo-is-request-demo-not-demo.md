# Paid packaging uses /request-demo, not /demo

**Date:** 2026-09-09
**Scope:** pricing, billing CTAs, demo booking
**Confidence:** HIGH
**Evidence:** `app/demo/` is the DemoSite fixture; `INDEXABLE_ROUTES` and paid CTAs now use `/request-demo`.

`/demo` is already the live sample site used for marketing captures. Booking a sales demo on that path would collide with the fixture. Paid intent while Stripe is closed goes to `/request-demo?plan=pro|studio`, persisted as `DemoRequest`, emailed via `DEMO_NOTIFY_EMAIL` (fallback `ADMIN_NOTIFICATION_EMAIL`). Never print the notify address. Do not reopen `STRIPE_PAID_OPEN` in a packaging pass.

Prevention: `lib/billing/demo-path.ts`, pricing parity tests, and `scripts/metadata-route-guard.mjs` mapping for `/request-demo`.
