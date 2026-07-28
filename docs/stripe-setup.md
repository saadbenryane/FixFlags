# Stripe setup (FixFlags)

Test vs live is determined only by key prefix (`sk_test_` / `sk_live_`) and matching price IDs. Never mix test prices with live keys.

## Current test catalog (account AjciMDcWE1)

Created 2026-07-19 in **test mode** (`livemode=false`).

| Product | Price ID | Env var | Amount |
|---------|----------|---------|--------|
| FixFlags Pro | `price_1Tv0h4AjciMDcWE189gBj6wf` | `STRIPE_BUILDER_PRICE_ID` | $39/mo |
| FixFlags Studio | `price_1Tv0h5AjciMDcWE1qGjHsdJR` | `STRIPE_TEAM_PRICE_ID` | $129/mo |
| Credit Pack +10 | `price_1Tv0h6AjciMDcWE1BtRvPmOg` | `STRIPE_CREDIT_PACK_10_ID` | $15 |
| Credit Pack +25 | `price_1Tv0h6AjciMDcWE1ShtiyPUu` | `STRIPE_CREDIT_PACK_25_ID` | $30 |
| Credit Pack +50 | `price_1Tv0h7AjciMDcWE1XZWi26WU` | `STRIPE_CREDIT_PACK_50_ID` | $50 |

Webhook (test): `https://fixflags.com/api/webhooks/stripe` — signing secret → `STRIPE_WEBHOOK_SECRET`.

**Discarded:** Older price IDs from account `acct_1SmkqdHLxDz5YKn1` (“OH Old”) must not be used.

## Local `.env.local`

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_RESTRICTED_KEY=rk_test_...   # operator/MCP only; not read by the app
STRIPE_WEBHOOK_SECRET=whsec_...     # Dashboard endpoint, or `npm run stripe:listen`
STRIPE_BUILDER_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...
STRIPE_CREDIT_PACK_10_ID=price_...
STRIPE_CREDIT_PACK_25_ID=price_...
STRIPE_CREDIT_PACK_50_ID=price_...
STRIPE_API_VERSION=2025-02-24.acacia
BILLING_REQUIRED=false              # local: allow boot while iterating
```

Local webhook forwarding (optional): install Stripe CLI, then `npm run stripe:listen` and use that `whsec_` for local only.

## Railway (production service)

Set via `railway variables set` (do not commit values):

- All Stripe vars above except `STRIPE_RESTRICTED_KEY`
- `BILLING_REQUIRED=true` once the set is complete

Confirm: `railway variables | rg STRIPE_|BILLING_` (redact secrets in logs).
Health: `/api/health` → `billingConfigured: true`.

## Dashboard checklist (test mode)

1. Customer Portal: cancel, update payment method, switch Pro↔Studio with proration
2. Stripe Tax enabled (Checkout uses `automatic_tax`)
3. Customer emails: receipts + invoices
4. Webhook events: subscription created/updated/deleted, invoice payment_failed/succeeded, checkout.session completed/expired, charge.refunded

## Live flip (when ready for real charges)

1. Create identical products/prices in **live** mode on the same FixFlags Stripe account
2. New live webhook endpoint + live `whsec_`
3. Railway: replace all Stripe vars with `sk_live_` / live price IDs / live webhook secret; keep `BILLING_REQUIRED=true`
4. Rotate any keys that were pasted in chat before going live
5. One real $39 smoke charge (refund if desired)

## Smoke

Stripe test card `4242 4242 4242 4242` → Pro checkout → webhook → user `plan=BUILDER` → Billing portal.

## Deploy readiness (Railway)

Confirmed present for revenue path (names only): `DATABASE_URL`, `REDIS_URL`, R2 set, `OPENAI_API_KEY`, `PAGESPEED_API_KEY`, auth URLs, `RESEND_*`, `ADMIN_NOTIFICATION_EMAIL`, full Stripe test set, `BILLING_REQUIRED=true`.

After variable changes, redeploy the web service. Then:

```bash
curl -sS https://fixflags.com/api/health | jq '{billingConfigured, degraded, status}'
```

Expect `billingConfigured: true`. Test checkout with card `4242…`.

Set `TOKEN_ENCRYPTION_KEY` before selling Agency GitHub repo scans.
