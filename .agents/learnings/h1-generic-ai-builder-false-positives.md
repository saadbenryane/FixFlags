# H1-generic AI builder false positives

**Date:** 2026-07-27
**Check module:** content.ts
**Confidence:** HIGH
**Evidence:** `npm run accuracy:eval` passed; manual spot-check of lovable.dev, bolt.new headings

## False positive pattern

`categoryHeadlinePatterns` included `/\bwith AI\.?$/i` and `/\bship faster\.?$/i` — these fired on headlines like "Ship faster with AI" or "Build with AI" which are legitimate product positioning statements, not generic copy.

## Root cause

The patterns matched AI-related phrases at the end of H1 text. But "Ship faster with AI" names an outcome ("ship faster") and a technology ("AI") — it is specific, not generic. The truly generic patterns are "the next-generation" and "next-gen" which never communicate a specific outcome.

## Fix

1. Removed `/\bwith AI\.?$/i`, `/\bship faster\.?$/i`, and `/\bpowered by AI\.?$/i` from `categoryHeadlinePatterns`
2. Added `/\bnext-gen\b/i` as a truly generic pattern
3. "the next-generation" was already present and remains

## Regression prevention

- `lib/audit/accuracy-corpus.ts`: builder fixtures (lovable, bolt) must have 0 false CRITICAL/IMPORTANT
- `npm run accuracy:eval` gate
- `.agents/accuracy/false-positives.json`: fp-004

## Related corpus entries

- `lovable-dev.html` (builder): `expectedTop3: ['trust-no-authority-signals', 'measurement-ga-gtm-posthog-missing', 'no-structured-data']`
- `bolt-new.html` (builder): `expectedTop3: ['trust-unsupported-claims', 'links-no-text', 'trust-no-authority-signals']`
