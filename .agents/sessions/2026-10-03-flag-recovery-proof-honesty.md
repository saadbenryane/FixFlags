# Flag recovery proof honesty

**Owner:** `grok-goal-01a1030f`

**Evidence level:** `20ac5b2c` is on production health. The Flag page was not walked in a signed-in browser. The verified-attempt follow-up below is locally verified and is not production-verified until its own health check matches.

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

## Deploy

The owner asked to deploy this recovery change. `20ac5b2cc9ab17a5dd5c2321edfd3ebe45f5377b` was pushed to `origin/main`. Railway `FixFlags` deployment `c15008ae-ca47-413d-9806-39ea9f9afe86` and `FixFlags Worker` deployment `da70f1f0-bef7-4db7-a4b0-ce075a6af837` both reached SUCCESS for that commit. `https://fixflags.com/api/health` reports that commit, `migrations: ok`. No second manual Railway deploy was started. Paid checkout stayed closed. MCP was not made newly discoverable.

Port 3000 on this machine is Commerce OS, not FixFlags. There is still no signed-in walk of one recovered Flag and one fixed Flag whose proof audit is missing.

## Verified attempt without resolvedInId

A later check can set the improvement to `VERIFIED` and store `verificationAuditId` without setting `resolvedInId`. The detail page now cites that audit when it is the newest comparable `IMPROVED` attempt, still only after the same-Site `COMPLETED` query. A recorded `resolvedInId` wins, and a failed match does not fall back to the attempt. `PROPOSED` with no `resolvedInId` stays Needs a fix. A `VERIFIED` Flag whose attempt audit is missing says Couldn’t verify and offers Verify.

Focused Vitest after that wiring: 3 files, 35 tests passed. Scoped ESLint passed. Ignoring the attempt id and keeping only `resolvedInId` failed 3 tests. Full `npm run agent -- verify` was not run.

The open list still omits `VERIFIED` improvements, and the Resolved list still requires a flag row with `FIXED` and `resolvedInId`. That Flag can be absent from both lists. The scan-allowance files stayed unstaged.

## Next action

After this follow-up is on `origin/main`, wait until `/api/health` matches that commit before calling the attempt proof live. Then show a verified improvement that has a completed attempt audit on the Resolved list, without calling a missing audit recovered. Leave the scan-allowance files to their owner. A signed-in phone and desktop walk is still outstanding.
