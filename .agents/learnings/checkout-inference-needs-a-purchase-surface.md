# Checkout inference needs a purchase surface

**Date:** 2026-10-05
**Scope:** Site outcome projection from an audit
**Confidence:** HIGH
**Evidence:** `lib/sites/__tests__/checkout-inference.test.ts` calls `syncOutcomesFromAudit` with the pricing product-contract sentences and passed twice (15/15).

## Discovery

A regex over the product contract, flag problem text, page URLs, and journey type treated the word checkout as a promise. The pricing heuristic says "start checkout or signup", so a pricing page became a required Checkout bound to the homepage. A checkout URL was also an acceptable start. The purchase walk cannot Clear either case.

## Why it matters

Checkout means a customer can add a product and reach checkout. Inferring it from copy asks FixFlags to verify a purchase it has not seen, then report Couldn't verify or, before the purchase rule, a false Clear.

## Correct approach

Create the Checkout outcome only when a buy can start on an observed surface. Prefer a product path, then a recorded buy, then a failed purchase attempt, then a cart, then a connected storefront that is not checkout. Do not read product-contract prose or flag problem text. Do not start on a checkout, payment, thank-you, or order-complete URL. Do not rewrite a customer-owned Checkout.

A dead checkout link on a page with no product or cart remains that Flag. It is not enough to promise the purchase walk.

## Prevention

`lib/sites/checkout-inference.ts` is the decision. `checkout-inference.test.ts` drives `syncOutcomesFromAudit` for pricing prose, a checkout-only journey, a product URL, a storefront, a customer-owned outcome, and a dead payment link on pricing.
