# Superlative heading false positives

**Date:** 2026-07-27
**Check module:** trust-psychology.ts
**Confidence:** HIGH
**Evidence:** `npm run accuracy:eval` passed; manual spot-check of vercel.com, stripe.com headings

## False positive pattern

`trust-unsupported-claims` fired when a heading contained any superlative ("the best/fastest/easiest/#1/leading/top") without `DATA_SPECIFICITY` (percentages, multipliers). Leadership terms like "leading", "trusted", "proven" are standard positioning language, not aggressive claims.

## Root cause

The check treated all superlatives equally. "The leading platform" is positioning language; "The #1 fastest" is an aggressive claim requiring evidence. A single heading match triggered IMPORTANT.

## Fix

1. Added `B2B_LEADERSHIP_TERMS` set: `leading`, `trusted`, `industry-standard`, `battle-tested`, `proven`, `enterprise-grade`
2. Leadership terms in headings downgrade from IMPORTANT to POLISH
3. Require 2+ leadership terms in headings for IMPORTANT
4. Aggressive superlatives (best, fastest, #1) remain IMPORTANT on single match

## Regression prevention

- `lib/audit/accuracy-corpus.ts`: gold fixtures must have 0 false CRITICAL/IMPORTANT
- `npm run accuracy:eval` gate
- `.agents/accuracy/false-positives.json`: fp-003

## Related corpus entries

- `vercel-com.html` (gold): `expectedTop3: ['friction-no-risk-reversal', 'trust-no-authority-signals', 'description-too-short']`
- `stripe-com.html` (gold): `expectedTop3: ['cookie-consent-absent', 'no-structured-data', 'description-too-long']`
