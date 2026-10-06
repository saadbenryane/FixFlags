# Blocked Checkout names the purchase next step

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b32696822436af66d064d70164cb65e9f`.

## Customer failure

Every Couldn’t verify Outcome told the customer to review the method or fixture. That sentence fits Signup. A blocked Checkout has no fixture. The purchase sentence already explained the block, and the next line still sent the customer to a fixture.

## Repair

When the Outcome is Checkout and the state is Couldn’t verify, the recovery line comes from `checkoutCouldNotVerifyRecovery` and the newest Checkout execution. No purchase control asks for a page with Add to cart or Buy. A bot challenge, a password gate, a time limit, and disagreeing attempts each have their own next step. Any other Checkout block says to verify again. Signup keeps the fixture sentence. A Checkout Flag still has no recovery line here, because the repair stays on the Flag. Page availability is unchanged in this slice.

## Evidence

- Before the repair, the detail loader returned the fixture sentence for `no_buy_control` and `bot_wall`. Observed vitest exit 1 at 23:00:01. Receipt: scratch `checkout-blocked-recovery-red.log`.
- After the repair, `lib/sites/__tests__/outcome-detail-evidence.test.ts` passed twice (10/10). The blocked Checkout uses the newest `no_buy_control` execution, including when an older success is still stored. Password, timeout, flaky, and an unrecognized reason stay off the fixture sentence. Signup keeps it. A failed add to cart leaves recovery empty. Receipts: `checkout-blocked-recovery-1.log` and `checkout-blocked-recovery-2.log`.
- ESLint on the loader, the sentence module, and the test passed. Receipt: `checkout-blocked-recovery-eslint.log`.
- No signed-in browser walk. The Outcome page prints `recoveryAction` from this loader and does not choose the sentence itself.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed. Developer-key files were not edited.

## Next

Page availability recovery is recorded in `.agents/sessions/2026-10-05-availability-blocked-recovery.md`. History on the Outcome page still shows the binding key and the raw reason code.
