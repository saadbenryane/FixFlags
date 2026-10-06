# A blocked Checkout names the purchase reason

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b`.

## Customer failure

When Checkout verification was blocked, the Outcome assessment stored "FixFlags could not complete the required coverage for this Outcome." The purchase walk had already recorded a reason such as no buy control or a bot wall, and `checkoutResultCopy` already had the customer sentence. Reconcile used that sentence for Clear and Flag, and skipped it for Couldn’t verify. The Outcome page and the MCP outcome read show that stored summary.

## Repair

Reconcile now stores the Checkout sentence whenever the binding ran and returned a reason. A Checkout with no execution still says coverage was incomplete, because there is no purchase result to explain. Signup and other kinds keep their own summaries. The purchase-walk verdict and Checkout inference are unchanged.

## Evidence

- `lib/sites/__tests__/run-requests.test.ts` calls `reconcileOutcomeRunsForAudit`. Both runs passed 32 tests. A blocked `no_buy_control` execution stores `checkoutResultCopy('no_buy_control').summary`. A `bot_wall` execution stores its Checkout sentence. An execution list that is empty stores the coverage sentence.
- ESLint on the touched reconcile files passed.
- The Outcome page renders `outcome.summary`, which is the latest assessment summary. This session did not walk a signed-in browser.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed.
