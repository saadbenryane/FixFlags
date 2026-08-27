# FixFlags → Cursor remediation quality

**Date:** 2026-08-27  
**Scope:** Finish Plan / editor handoff Tasks vs live dogfood on personal portfolio sites  
**Confidence:** high  
**Evidence:** Customer pasted saadbenryane.com FixFlags Copy-all into Cursor; Cursor’s remediation plan re-verified live + repo and discarded FixFlags overclaims. Root causes fixed in journey fix templates, heading check IDs, security-header consolidation, page-purpose personal path, and evaluator grounding.

## Findings

1. **Specific problem + generic Task is a product failure.** Journey friction always shipped “Review this step / Reduce cognitive load.” Accessibility barriers always shipped keyboard/ARIA Tasks even when the barrier was heading structure. Editors then re-judge the product.
2. **Security-header consolidation overclaimed.** Mixing aspirational headers (preload, COOP/COEP) into “N security headers are missing or weak” with a fix that always lists DENY/CSP/HSTS made sites with core headers look broken.
3. **Personal sites with contact CTAs were classified as marketing** because purpose required `ctaCount === 0`. Journeys then invented pricing/signup dead-ends and commercial broken promises.
4. **`heading-order` and “missing H2s” shared one checkId**, so why/verify copy said “add H2s” for order violations.
5. Editor handoff’s plan-then-implement framing is valuable; it needs a scope guardrail against inventing pricing/signup pages.

## Prevention

- Type-specific journey fixes: `lib/audit/journey/evaluation-fix.ts`
- Heading IDs split: `heading-hierarchy-missing` vs `heading-order-skipped`
- Core-only `security-headers-missing`; cores-present hardening via `security-headers-hardening`
- Personal purpose allows contact/booking CTAs; journey catalog skips pricing/signup for non-product purpose
- Broken-promise filter + evaluator prompt grounding for personal sites
- Editor handoff: stay within listed items; do not invent pricing/signup
- Regression: `lib/audit/__tests__/dogfood-quality-remediation.test.ts`
