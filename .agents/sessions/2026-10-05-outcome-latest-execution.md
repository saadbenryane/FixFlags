# Outcome evidence shows the newest execution

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

The Outcome page asks for binding executions newest first, then builds a map from that list. A map keeps the last write, so the oldest execution in the window became the evidence card. A later Verify stores a new row because an execution is unique per audit, outcome, and binding. After a successful purchase check, the card could still describe an older blocked attempt. History is a separate append-only list and was not the bug.

## Repair

`loadSiteOutcomeDetail` keeps the first execution for each binding key. The page and the outcome API both read that view, so the evidence card and `OutcomeBindingResult` now describe the newest attempt. Older attempts stay on the history timeline. Assessments were already newest-first at index 0 and were not changed. The Shopify opening-checkout result was not changed.

## Evidence

- Before the repair, `lib/sites/__tests__/outcome-detail-evidence.test.ts` failed. The Checkout evidence was the 2026-10-01 blocked `no_buy_control` row, not the 2026-10-05 `checkout_reached` row. Receipt: scratch `outcome-latest-execution-red.log` (observed vitest exit 1 at 22:56:31).
- After the repair, the same test passed twice (2/2). A later success replaces an earlier block. A later page failure replaces an earlier success. A binding with no execution stays empty. Both Checkout attempts remain in history. Receipts: `outcome-latest-execution-1.log` and `outcome-latest-execution-2.log`.
- ESLint on `lib/sites/outcomes.ts` and the test passed. Receipt: `outcome-latest-execution-eslint.log`.
- The test calls `loadSiteOutcomeDetail` and then `customerBindingResult`, which is the sentence the Outcome page renders. No signed-in browser walk. The selection bug is in the loader, and the page does not choose among executions itself.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

Checkout Couldn’t verify recovery is recorded in `.agents/sessions/2026-10-05-checkout-blocked-recovery.md`. Page availability that could not be verified still uses the fixture sentence.
