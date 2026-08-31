# Observation identity and offer type

**Date:** 2026-08-31
**Scope:** Flag matching, conversion first-step, Update review score
**Confidence:** high
**Evidence:** saadbenryane.com production report `cmtgkvqd50001n020ae6okywu`; shopify-demo-store expected a missing-path Flag on a page with Add to Cart

## Discovery

Update review matched AI Flags by restated problem text and deterministic Flags without journey aliases. Persist hashed identity with page URL. Conversion checks treated SaaS trial/demo/pricing as the product, then accumulated contact regexes.

## Correct approach

One `observationIdentity` for persist, collapse, diff, and Improvements. Stored AI identity wins over a restated title. First-step checks run on marketing and studio pages; any matching first step is enough. Offer type only changes the missing-path prescription. Commerce Add to Cart is a first step. Comparable score uses the same diagnostic formula on identities from last time.

## Prevention

- `lib/audit/flag-identity.ts`
- `lib/audit/page-purpose.ts` `studio` purpose + `needsFirstStep`
- `lib/audit/checks/conversion-friction.ts`
- `comparableScoreFromDiff`
- `npm run accuracy:eval`
