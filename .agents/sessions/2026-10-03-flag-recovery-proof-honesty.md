# Flag recovery proof honesty

**Owner:** `grok-goal-01a1030f`

**Evidence level:** locally verified. Not production-verified, not deployed, and not customer-validated.

**Barrier:** trust. A newcomer on a fixed Flag could not tell whether it was recovered, still needed a fix, or had no proof.

## Avoided owners

- `consent-aware-landing-to-site-attribution-2026-10-03` (codex-root, in progress)
- Uncommitted scan-allowance edits already on `SiteBoard.tsx`, `SiteBoard.test.tsx`, `lib/__tests__/billing-runtime.test.ts`, `lib/api/errors.ts`, `lib/audit/usage.ts`, `lib/security/anonymous-claim.ts`, `lib/marketing/copy/auth.ts`, `lib/marketing/copy/plans.ts`, and `lib/sites/application/run-requests.ts`. No scope transfer. Those files were left untouched.
- Shopify install, the JEV experiment, and opencode Wave 2 Outcome detail, including the Wave 1 goal-probe handoff

## Customer outcome

A Flag says Recovered only when the recorded proof is a completed audit on this Site. The page shows the date and "That check no longer found the problem." It does not say Needs a fix.

When that proof is missing, unfinished, mismatched, or undated, the page says Couldn’t verify and offers Verify. It does not say Recovered, Needs a fix, or Verifying.

While a verification attempt has no outcome yet, the status is Verifying. An earlier completed check stays visible as the last completed check, not as the current result.

The Resolved list no longer introduces every row as verified as fixed. It tells the customer to open the Flag for the completed check.

## Implementation

- `flagResolutionView` in `lib/sites/flag-resolution.ts` is the decision the page calls.
- `FlagResolutionPanel` renders that decision, including Verify from the existing Flag actions when proof is missing.
- The Flag page still loads the proof audit with the same Site and `COMPLETED` status.
- Customer sentences live on `SITE_BOARD_COPY`.

## Evidence

- Focused Vitest: 3 files, 21 tests passed. Log: goal scratch `test.log`.
- With the unproven branch replaced by an open "Needs a fix" answer, 2 tests failed (`test-absent.log`): the decision test expected `unproven`, and the panel test expected Couldn’t verify plus Verify.
- The panel the Flag page renders was executed twice. Both runs printed the same text: Recovered with the dated observation and proof audit id; Couldn’t verify with the missing-proof sentence and Verify fix; Verifying with the last-completed-check note. Log: goal scratch `path.log`.
- `curl` to `127.0.0.1:3000` and `127.0.0.1:4242` failed to connect, so there was no signed-in browser walk.
- ESLint on the touched Flag files passed with zero warnings.
- Full `npm run agent -- verify` was not run. No release-gate receipt exists.

## Rejected

- Putting the status change in `SiteBoard.tsx`, which another session is editing for scan allowance.
- Treating a missing proof as Needs a fix. That hides the failed recovery and leaves no next step.
- Keeping "verified as fixed" as the current claim. The dated check is the whole statement.

## Follow-up

`loadSiteFlagDetail` shows `improvement.status` when a Flag is linked to an improvement. That status is `PROPOSED` until a check sets `VERIFIED`. Gating Recovered on the flag-row value `FIXED` still printed Needs a fix and hid the dated check, including while a new attempt was running. `siteFlagDetailStatus` is what the loader returns, and `flagResolutionView` treats `PROPOSED` and `VERIFIED` with a matching completed proof as Recovered. Re-verification keeps that check as the last completed check. A proposed improvement with no recorded proof still says Needs a fix.

The regression calls `siteFlagDetailStatus('PROPOSED' | 'VERIFIED', 'FIXED')` and then `flagResolutionView`. Forcing the proof lookup back to `FIXED` failed those tests. Focused result after the fix: 3 files, 26 tests passed.

## Next action

Do not deploy and do not push. When a local Next server and a signed-in Site are available, open one recovered Flag and one fixed Flag whose proof audit is missing, at phone width and desktop width. Until then, leave the scan-allowance files to their owner.
