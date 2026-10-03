# A verified improvement cites its own check

- Date: 2026-10-03
- Scope: Flag detail recovery when `resolvedInId` was never set
- Confidence: high for the local decision; the detail page was not walked in a signed-in browser

## Evidence

`VERIFY_FLAG` records an attempt and starts an Outcome run. It does not set the flag row to `FIXED` or fill `resolvedInId`. When that run is comparable and the condition is gone, `lib/improvements/service.ts` stores `verificationAuditId` and sets the improvement to `VERIFIED`. `loadSiteFlagDetail` then returns `VERIFIED`. The shipped recovery decision only treated a matching `resolvedInId` as proof, so this Flag stayed Needs a fix while its attempt said Verified.

## Discovery

The proof id and the flag-row status are different records. An improved attempt already names the audit that should be shown. A recorded `resolvedInId` still wins. If that id does not match a completed same-Site audit, the page does not borrow the attempt id.

## Why it matters

The last step of Flag, Fix, Verify is the customer reading the check that recovered the Flag. A verified improvement with no flag-row proof id was invisible as a recovery.

## Correct approach

`flagRecoveryProofId` reads attempts newest first. It returns `resolvedInId` when present. Otherwise, only for `VERIFIED`, it returns the newest attempt with outcome `IMPROVED`, `comparable: true`, and a non-empty `verificationAuditId`. The Flag page loads that id with the same Site and `COMPLETED` status. `flagResolutionView` accepts it as `attemptProofId` only when `resolvedInId` is absent. A missing check says Couldn’t verify and offers Verify. `PROPOSED` with no `resolvedInId` stays Needs a fix.

## Prevention encoded

`lib/sites/__tests__/flag-resolution.test.ts`, `components/sites/__tests__/FlagResolution.test.tsx`, and the Flag page source guard in `components/sites/__tests__/SiteFlagsView.test.tsx`. Replacing the attempt-id lookup with `resolvedInId` alone failed the Recovered decision, the in-flight history note, and the panel. The product skill states the same rule.

## Resolved list

The open Flag list omits `VERIFIED`. `loadSiteResolvedFlags` now also loads a `VERIFIED` improvement when a comparable `IMPROVED` attempt has a `verificationAuditId`, and `selectResolvedFlags` shows that row once. The detail page still requires the audit to be a completed check on the same Site before it says Recovered. This list change is local until its own deploy.
