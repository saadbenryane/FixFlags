# Learning: Payments live readiness

*Validated 2026-07-19*

## Pitfalls

1. **Wrong Stripe account:** MCP or Dashboard connected to a different account than FixFlags keys produces price IDs that 404 at checkout. Always create catalog with the same `STRIPE_SECRET_KEY` that Railway uses (`docs/stripe-setup.md`).
2. **Copy vs enforcement:** Marketing once promised “unlimited deterministic checks” at Free limit while `create-audit` hard-blocked all new URL checks. One quota: new URL checks. Re-checks free. Align copy to code.
3. **Webhook plan lag:** `invoice.payment_failed` must re-sync via `processSubscription` (not status-only). Otherwise UI shows Pro while entitlements are revoked.
4. **Post-checkout race:** Success toast must poll `/api/me` until plan matches before claiming features.
5. **Partial env:** Secret without price IDs → 503 at checkout. Use `isBillingFullyConfigured` + `BILLING_REQUIRED`.
6. **Concurrent agents:** Uncommitted copy/legal edits can be overwritten by other `main` commits. Re-grep `unlimited deterministic` before claiming done.

## Operator checklist

- Test mode first (`sk_test_`), then live flip with identical products.
- Railway: set Stripe vars + redeploy; confirm `/api/health.billingConfigured`.
- Rotate any keys pasted into chat before going live.
