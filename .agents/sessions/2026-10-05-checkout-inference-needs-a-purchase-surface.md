# Checkout inference needs a purchase surface

Date: 2026-10-05
Owner: grok-goal-01a10ddc
State: implemented and locally verified. Not deployed. Production remains `dd1c247b`.

## Customer failure

Analysis created a required Checkout outcome from prose. The pricing product contract says "start checkout or signup" and "the buy or start path works". A joined string of that contract, flag text, and page URLs matched the word checkout, then bound verification to the site homepage when no product URL existed. A checkout page with no product or cart could become the start as well.

After Checkout Clear required a real buy, those bindings cannot succeed. The customer still received a Checkout promise FixFlags had not seen a place to buy.

## Repair

`syncOutcomesFromAudit` now creates Checkout only from `observedPurchaseStart`. The start URL is the first of: a same-host product path, a step that recorded a buy, a page where a purchase attempt failed, a cart path, or a connected storefront that is not itself checkout. Payment, thank-you, and order-complete URLs are not starts. The site homepage is not a fallback.

A journey merely named checkout does not create the outcome. Flag problem text does not count. A dead checkout link on a pricing page stays a Flag and does not become this promise. A Checkout the customer already owns is left unchanged.

The purchase-walk verdict is unchanged. Login, Password reset, safe Signup, and page availability are unchanged.

## Evidence

- `lib/sites/__tests__/checkout-inference.test.ts` calls `syncOutcomesFromAudit`. Both runs passed the same 15 tests. Pricing prose, a checkout-only page, a checkout journey with no buy, a checkout storefront, a dead payment link on pricing, and a customer-owned Checkout do not write `checkout-browser-v1`. A product URL, a collection product URL, a recorded buy, a failed purchase attempt on a non-checkout page, a cart storefront, and a provisional product page do, with `config.startUrl` equal to that surface.
- Related outcome confirmation, kind contract, and Checkout persistence tests: 36 passed alongside the inference file (51 total).
- ESLint on the touched inference files passed.
- Not pushed, not deployed, and not customer-validated. Paid checkout and public MCP discovery stay closed.

## Limits

An unconfirmed Checkout already stored by the old prose rule is not deleted. The next analysis corrects its start URL only when a buyable surface is present and the customer does not own the outcome. A connected storefront homepage can still be the start when no product, cart, buy step, or purchase attempt was captured. That page may not contain an add-to-cart control, so verification can remain Couldn't verify until a product URL is observed.
