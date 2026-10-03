# A fixed Flag without completed proof is not recovered

- Date: 2026-10-03
- Scope: Flag detail status and the Resolved list introduction
- Confidence: high for the local decision; no production walk

## Evidence

The Flag page always printed `Needs a fix`, including when `status` was `FIXED`. The proof section rendered only when a completed same-Site audit was found, and the fix actions were hidden for every `FIXED` Flag. A missing, unfinished, or mismatched proof therefore left no status and no Verify. The Resolved list introduced every row as verified as fixed.

`loadSiteFlagDetail` returns `siteFlagDetailStatus(improvement.status, flag.status)`. A linked improvement is `PROPOSED` until a check sets `VERIFIED`, so the page does not receive the flag-row value `FIXED`. `flagResolutionView` returns Recovered for that loaded status when `resolvedInId` matches a completed proof audit. The same proof stays visible as the last completed check while a new attempt is Verifying. A recorded proof id with no completed match returns Couldn’t verify and Verify. A proposed improvement with no proof id stays Needs a fix. Forcing the proof lookup back to `FIXED` failed the regression.

## Discovery

`FIXED` is a stored status, not a customer answer. The answer needs the proof audit the status points at. Hiding both the proof and the next step makes an unverified recovery look like an open Flag that cannot be acted on.

## Why it matters

A newcomer cannot trust a recovery, or know what to do, when the page leads with the wrong status. That is the last step of Flag, Fix, Verify.

## Correct approach

Decide the status in `flagResolutionView` and render it through `FlagResolutionPanel`. Keep the same-Site `COMPLETED` query on the Flag page. Say Recovered only with the dated observation. Say Couldn’t verify and offer Verify when the proof is missing. Say Verifying only while an attempt is unfinished, and label any earlier check as the last completed check.

## Prevention encoded

`lib/sites/__tests__/flag-resolution.test.ts`, `components/sites/__tests__/FlagResolution.test.tsx`, and the Resolved-list assertion in `components/sites/__tests__/SiteFlagsView.test.tsx`. The product skill states the same rule.
