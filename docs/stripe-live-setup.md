# Stripe live catalog (FixFlags)

Created 2026-07-19 on Stripe account `acct_1SmkqdHLxDz5YKn1` (livemode).

| Product | Price ID | Env var | Amount |
|---------|----------|---------|--------|
| FixFlags Pro | `price_1Tv0ZbHLxDz5YKn1FmFlmUB0` | `STRIPE_BUILDER_PRICE_ID` | $29/mo |
| FixFlags Agency | `price_1Tv0ZgHLxDz5YKn1dIbHKodO` | `STRIPE_TEAM_PRICE_ID` | $99/mo |
| Credit Pack +10 | `price_1Tv0ZhHLxDz5YKn1woFohBa4` | `STRIPE_CREDIT_PACK_10_ID` | $15 |
| Credit Pack +25 | `price_1Tv0ZiHLxDz5YKn1wbWZ66vj` | `STRIPE_CREDIT_PACK_25_ID` | $30 |
| Credit Pack +50 | `price_1Tv0ZiHLxDz5YKn1SA2pNd62` | `STRIPE_CREDIT_PACK_50_ID` | $50 |

## Railway / production env (set these)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BUILDER_PRICE_ID=price_1Tv0ZbHLxDz5YKn1FmFlmUB0
STRIPE_TEAM_PRICE_ID=price_1Tv0ZgHLxDz5YKn1dIbHKodO
STRIPE_CREDIT_PACK_10_ID=price_1Tv0ZhHLxDz5YKn1woFohBa4
STRIPE_CREDIT_PACK_25_ID=price_1Tv0ZiHLxDz5YKn1wbWZ66vj
STRIPE_CREDIT_PACK_50_ID=price_1Tv0ZiHLxDz5YKn1SA2pNd62
BILLING_REQUIRED=true
```

## Operator checklist (Dashboard)

1. [ ] Customer Portal: cancel, update payment method, switch Pro↔Agency with proration
2. [ ] Stripe Tax enabled (Checkout uses `automatic_tax`)
3. [ ] Customer emails: receipts + invoices
4. [ ] Live webhook → `https://fixflags.com/api/webhooks/stripe` (or current prod URL) with events listed in `fixflags-product` skill
5. [ ] Copy `whsec_...` signing secret into Railway as `STRIPE_WEBHOOK_SECRET`
6. [ ] Confirm business identity / payouts are active for live charges
