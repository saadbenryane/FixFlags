# Pricing page load

**Date:** 2026-09-09
**Task:** `pricing-page-load`
**Branch:** `main`

`/pricing` was slow because the whole page was a client component (`PricingPageClient`) that pulled `useMe`, analytics, FAQ accordion, compare tooltips, and a static `pick-plan` / checkout import into the first paint. The marketing layout also called `headers()` only to toggle help/faq support, which dynamized every public marketing route.

The page is now a server component. Plan cards, comparison, and copy render in HTML. Client islands are the CTAs, view tracker, FAQ accordion, and compare tooltips. Checkout planning loads on click. Help/faq keep live support via nested `KnowledgeSupportShell` layouts. FAQPage JSON-LD from `faq-accordion-schema` is preserved.

## Files

- `components/pricing/PricingPage.tsx` (server; replaces `PricingPageClient`)
- `components/pricing/PricingCTAButton.tsx`, `PricingViewTracker.tsx`
- `app/(marketing)/pricing/page.tsx`, `layout.tsx`, `help/layout.tsx`, `faq/layout.tsx`
- `components/layout/KnowledgeSupportShell.tsx`
- `components/marketing/MarketingCompareSection.tsx` (server; no `"use client"`)
- tests under `app/(marketing)/` and `components/pricing/__tests__/`

## Verification

- `npx tsc --noEmit --incremental false` passed
- Focused vitest: pricing page, layout-static, PricingCTAButton, PlanPrice, FaqSection, pricing-parity
- `curl localhost:3000/pricing` HTML contains headline, `$49`, Volume, FAQPage schema
- Browser: homepage → Pricing, FAQ opens, Pro demo CTA → `/request-demo?plan=pro`, `/help` and `/faq` still render. Warmed mobile nav ~430ms
- `npm run image:local-patterns-guard` passed
- Full `ui:drift-guard` still fails on unrelated Site/Shopify files owned elsewhere
- `BillingPlansSection` test still fails on two "Request a demo" buttons; pre-existing packaging copy, not this change

## Follow-ups

None for load. Do not deploy. Preserve `faq-accordion-schema` work on FaqSection and JSON-LD.
