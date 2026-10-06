# Checkout Clear requires a buy

**Date:** 2026-10-05
**Scope:** Checkout binding execution
**Confidence:** HIGH
**Evidence:** `lib/sites/__tests__/checkout-purchase-probe.test.ts` ran twice against the local buy-path fixtures with the browser probe unmocked. Both runs passed the same five assertions.

## Discovery

A wait-only checkout goal, and a same-audit review marked `goalAchieved` with no buy step, could both become Clear. The shared purchase walk also treats an opening checkout URL as success. That verdict is not a purchase.

## Why it matters

Clear means FixFlags used a buy control and then reached checkout. A page that is already checkout, or a review that only waited there, has not shown that a customer can buy.

## Correct approach

Keep the purchase decision pure. Success is this attempt's buy action followed by a checkout URL that is not payment, thank-you, or order completion. Reuse a stored review only when its steps already record that buy. Leave the shared walk's opening-checkout classification in place for Shopify alerts, and do not accept it as Checkout Clear.

## Prevention

`lib/integrity/purchase.ts` is the decision. `checkout-purchase-probe.test.ts` drives `runBoundCheckoutForAudit` through the real probe for the working cart, the dead add to cart, the page with no buy control, an already-checkout start, and a shallow prior `goalAchieved`.
