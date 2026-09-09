# Public marketing pages cannot be fully client components

**Date:** 2026-09-09
**Scope:** marketing routes, especially `/pricing`
**Confidence:** HIGH
**Evidence:** `/pricing` was one `"use client"` tree. Clicking Pricing showed `app/(marketing)/loading.tsx` until the client chunk and checkout planner loaded. After splitting into a server page plus CTA/analytics islands, HTML already contained the headline, `$49`, and FAQ JSON-LD; warmed client navigation was ~430ms locally.

`headers()` in `app/(marketing)/layout.tsx` (used only to toggle help/faq support) dynamizes every marketing route and weakens Link prefetch. Nested help/faq layouts can mount support without making `/pricing` dynamic.

Do not statically import `lib/billing/pick-plan` into first-paint pricing JS. Paid checkout is closed; gated CTAs only need `demoPathForPlan`. Load the planner on click.

Prevention: `components/pricing/PricingPage.tsx` is a server component; `app/(marketing)/pricing/__tests__/page.test.tsx` and `app/(marketing)/__tests__/layout-static.test.tsx` lock the contract.
