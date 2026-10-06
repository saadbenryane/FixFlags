# Home shows the Checkout assessment

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b`.

## Customer failure

Home rendered a watched Outcome as its promise. A blocked Checkout assessment already had a sentence such as "FixFlags could not find a safe purchase control to exercise," and the Outcome page could show it. The home card passed the expectation whenever one existed, so the first screen still hid the result.

## Repair

The watched Outcome card shows the stored assessment when it is a real result, and keeps the promise on the next line. The placeholder "Not verified yet." stays off the card, so an Outcome that has not been assessed still shows its expectation. The public sample card does not pass an assessment, so it stays a configuration sample.

## Evidence

- `components/sites/__tests__/SiteBoard.test.tsx` renders `SiteBoard`. Both runs passed. A blocked Checkout shows `checkoutResultCopy('no_buy_control').summary`, the purchase promise, and Couldn’t verify. An unassessed Checkout shows the promise and does not show the placeholder.
- The second run also passed the customer-copy truth checks (29 tests with the home suite).
- ESLint on the touched card, home, and outcome files passed.
- No signed-in browser walk. The rendered home component is the surface a customer sees.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed.
