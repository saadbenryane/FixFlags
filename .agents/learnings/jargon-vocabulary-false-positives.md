# Jargon vocabulary false positives

**Date:** 2026-07-27
**Check module:** messaging-clarity.ts
**Confidence:** HIGH
**Evidence:** `npm run accuracy:eval` passed; manual spot-check of stripe.com, vercel.com, linear.app headings

## False positive pattern

`JARGON_PATTERNS` included `seamless`, `robust`, `scalable`, `innovative`, `end-to-end`, `ecosystem` — all standard B2B vocabulary. A single occurrence triggered POLISH; two triggered IMPORTANT. Legitimate product pages like Stripe ("Seamless integration") and Vercel ("Scalable infrastructure") were flagged.

## Root cause

The jargon list treated common B2B positioning language as a defect. These words are standard in SaaS marketing and do not reduce clarity when used in a clear headline with audience + outcome.

## Fix

1. Moved B2B-common terms to a separate `B2B_COMMON_TERMS` set
2. Pure jargon (leverage, synergy, paradigm) still triggers POLISH on first match
3. B2B-common terms require 3+ total jargon matches for IMPORTANT
4. Skip jargon check entirely when headline has both audience AND outcome

## Regression prevention

- `lib/audit/accuracy-corpus.ts`: gold fixtures (stripe, vercel, nextjs) must have 0 false CRITICAL/IMPORTANT
- `npm run accuracy:eval` gate
- `.agents/accuracy/false-positives.json`: fp-002

## Related corpus entries

- `fixflags-com.html` (gold): `knownFalsePositives: ['form-missing-validation']`
- `vercel-com.html` (gold): `knownFalsePositives: ['template-default-copy', 'placeholder-copy-detected', 'scroll-ghost-sections', 'links-no-text']`
