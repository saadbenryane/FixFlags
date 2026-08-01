# GTM launch plan (working session)

**Status:** In progress (August 2026).

**Canon:** [docs/gtm-launch-strategy.md](../docs/gtm-launch-strategy.md)

---

## Checklist

### Documentation
- [x] gtm-launch-strategy.md
- [x] founder-offer.md
- [x] gtm-metrics.md
- [x] legal-launch-checklist.md
- [x] CANONICAL-SOURCES, DECISIONS, business-model pointers

### Phase 1 — Stripe founder offers
- [x] lib/billing/founder-offers.ts
- [x] Checkout promotion support
- [x] Env: STRIPE_PAID_OPEN, founder promotion IDs
- [x] stripe-setup.md: $69/$199 + coupons

### Phase 2 — Waitlist DB
- [x] Prisma PaidPlanWaitlistEntry
- [x] beta-interest API → persist + confirm email
- [x] waitlist_joined analytics

### Phase 3 — PAID_OPEN UI
- [x] Pricing, dashboard, plan picker gating
- [x] Founder copy in plans.ts
- [x] Homepage teaser line

### Phase 4 — Admin
- [x] /admin/waitlist + export
- [x] waitlist-segments.ts

### Phase 5 — Legal
- [x] Terms + privacy updates
- [x] legal-launch-checklist sign-off (founder + waitlist sections)

---

## Open questions

- Metering in usage.ts before paid ads scale
- Live Stripe price IDs after business registration
