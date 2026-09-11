# Pricing packaging: $49 per website

**Date:** 2026-09-09
**Task:** `pricing-packaging-49`
**Branch:** `main`
**Owner:** grok

Public list is `$49` per website per month. Free: one website, verified weekly. Pro: verified every day. Studio: quiet waitlist line, not a third card. Paid CTA is Join waitlist. Stripe stays closed. Live Stripe IDs remain `$39`/`$129`. Hidden `auditLimit` 3/30/90 is not printed.

Cost envelope is documented, not measured in this pass: paid COGS target ~`$12`/site/mo; measure `auditRunCost` p50 before `STRIPE_PAID_OPEN`. Pulse is later; do not claim it. Do not print 24/7, hourly Flag audits, page counts, or a nameless Beta.

`/request-demo` remains as a URL. It is not the Pro card.

# Pricing packaging: $49 per website

**Date:** 2026-09-09
**Task:** `pricing-packaging-49`
**Branch:** `main`
**Owner:** grok

Public list is `$49` per website per month. Free: one website, verified weekly. Pro: verified every day. Studio: quiet waitlist line, not a third card. Paid CTA is Join waitlist. Stripe stays closed. Live Stripe IDs remain `$39`/`$129`. Hidden `auditLimit` 3/30/90 is not printed.

Cost envelope is documented, not measured in this pass: paid COGS target ~`$12`/site/mo; measure `auditRunCost` p50 before `STRIPE_PAID_OPEN`. Pulse is later; do not claim it. Do not print 24/7, hourly Flag audits, page counts, or a nameless Beta.

`/request-demo` remains as a URL. It is not the Pro card.

## Verification

- `npx tsc --noEmit --incremental false` passed
- Focused vitest: 10 files, 145 tests passed (pricing-parity, homepage-message, pick-plan, PricingCTAButton, PlanPickerDialog, billing-enforcement, shopify-customer-ready, structured-data, /pricing page, FaqSection)
- `billing:plans-guard`, `copy-drift-check`, `help:catalog-guard` passed
- Browser `/pricing`: two cards (Free, Pro), `$49`, Studio waitlist line, no plan-vs-plan table, no 24/7 or hourly. Layout stacked at 375/768, two columns at 1280. Analyze → `/new`. Pro CTA `Join Pro waitlist` → `/waitlist/pro`. FAQPage JSON-LD includes `/waitlist/pro`.

Preserve `homepage-end-user-polish`, `board-card-chrome`, `shopify-app-launch`. No `lib/integrity/*`. No deploy. No Stripe open.
