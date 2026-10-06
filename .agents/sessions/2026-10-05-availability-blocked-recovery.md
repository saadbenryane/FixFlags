# A blocked page names the availability next step

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

A page that could not be verified used the Signup sentence: review the method or fixture. Page availability has no fixture. The block is a non-public address, a redirect, a challenge, a missing rendered page, or a request that did not complete.

## Repair

When the Outcome kind is page availability and the state is Couldn’t verify, the recovery line comes from `availabilityCouldNotVerifyRecovery` and the newest HTTP availability execution. A non-public address asks for a public page. A redirect asks for the page that answers directly. A challenge waits for a public request that can pass it. A missing rendered page and an incomplete request say to verify again and name what the check lacked. Any other availability block says to verify again. Signup still uses the fixture sentence. An unavailable page that became a Flag still has no recovery line here. Checkout recovery is unchanged.

## Evidence

- Before the repair, `loadSiteOutcomeDetail` returned "Review the method or fixture, then verify again." for `not_public`, `redirect_unfollowed`, `bot_wall`, `rendered_surface_unavailable`, `request_failed`, and an unrecognized reason. The newest execution was already `not_public` when an older success was stored. Signup and both Flag cases passed. Receipt: scratch `availability-blocked-recovery-red.log` (vitest exit 1 at 23:03:04, 6 failed, 11 passed).
- After the repair, the same file passed twice (17/17). Receipts: `availability-blocked-recovery-1.log` and `availability-blocked-recovery-2.log`.
- ESLint on the loader, the sentence module, and the test passed. Receipt: `availability-blocked-recovery-eslint.log`.
- No signed-in browser walk. The Outcome page prints `recoveryAction` from this loader.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Limit

`rendered_surface_unavailable` is also stored when the check has no rendered page text, including when the audit has no HTML metadata. The sentence says the check had no rendered page to read. It does not claim the customer's page is broken.

## Next

History copy is recorded in `.agents/sessions/2026-10-05-outcome-history-sentence.md`. "How this is checked" still shows the binding key.
