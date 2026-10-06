# Checkout Clear requires a buy

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b`.

## Customer failure

Checkout verification could report Clear without attempting a purchase. The worker ran a wait-only URL goal, so landing on a checkout URL was enough. A same-audit review already marked `goalAchieved`, with no buy step, was copied forward as success.

## Repair

Checkout binding now runs the purchase walk. Success requires this attempt to use a buy control and then reach checkout. An opening checkout URL is not that attempt, and a final payment, thank-you, or order-complete URL is not Clear. The walk stops before payment and does not place an order.

A stored review is reused only when its steps already record a buy. A shallow `goalAchieved` flag does not short-circuit the new walk into Clear.

Confirmed add-to-cart failure still becomes one customer journey Flag. A missing buy control, a bot wall, and a flaky recovery stay off that Flag. Login, Password reset, safe Signup, and page availability are unchanged. The shared Shopify walk still classifies an opening checkout URL as green for its own alerts. Checkout does not accept that verdict as Clear.

## Evidence

- `lib/sites/__tests__/checkout-purchase-probe.test.ts` drives `runBoundCheckoutForAudit` with the real browser probe and the local buy-path fixtures. Both runs passed the same five assertions: working cart, dead add to cart, no buy control, already-checkout start, and a goal-achieved review with no buy.
- `lib/sites/__tests__/checkout-execution.test.ts`: 8 passed. A confirmed purchase failure is one Flag. A blocked result is not. A stored purchase walk is reused. A shallow achieved review is not.
- `lib/integrity/__tests__/run-path-probe.test.ts`, `classify.test.ts`, and `purchase.test.ts`: 17 passed.
- The same three suites were run again on the current tree. The unmocked probe passed twice (5/5), persistence passed 8/8, and the path, classify, and purchase tests passed 17/17.
- Those suites were run again after the Site coverage change. The unmocked probe passed twice (5/5), persistence passed 8/8, and the path, classify, and purchase tests passed 17/17. The same five purchase assertions held on both probe runs.
- The unmocked probe was run again twice (5/5), persistence again (8/8), and the path, classify, and purchase tests again (17/17). Check again board tests were not used as this proof.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed.
