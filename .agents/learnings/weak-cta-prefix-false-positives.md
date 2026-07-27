# Weak CTA prefix false positives

**Date:** 2026-07-27
**Check module:** mobile-ux-quality.ts
**Confidence:** HIGH
**Evidence:** `npm run accuracy:eval` passed; manual spot-check of lovable.dev, stripe.com CTAs

## False positive pattern

`weakPhrases` included `start` and `try` with `startsWith` matching. "Get started" matched `startsWith('start')` and "Try free" matched `startsWith('try')`. These are standard, effective CTAs used by every major SaaS product.

## Root cause

The `startsWith` approach treated any CTA beginning with "start" or "try" as vague. But "Get started" and "Try free" are outcome-specific — the user knows they're starting a trial or trying the product. Only standalone "start" or "try" without context is vague.

## Fix

1. Removed `start` and `try` from `weakPhrases` entirely
2. Changed single-word matches to exact match only: `ctaText === 'submit'` instead of `ctaText.startsWith('submit')`
3. Kept multi-word phrases with `startsWith`: `click here`, `learn more`, `read more`

## Regression prevention

- `lib/audit/__tests__/fixtures/non-html-regression.json`: mobile layout cases
- `npm run accuracy:eval` gate
- `.agents/accuracy/false-positives.json`: fp-005

## Related corpus entries

- `lovable-dev.html` (builder): CTA "Get started" should not trigger mobile-cta-weak-label
- `stripe-com.html` (gold): CTA "Start now" should not trigger mobile-cta-weak-label
