# 40% Founder Discount

**Customer-facing name:** 40% Founder Discount

**Status:** Launch cohort offer (August 2026). Canonical for Stripe objects, checkout rules, and legal terms.

**Strategy context:** [gtm-launch-strategy.md](./gtm-launch-strategy.md)

---

## Offer terms (customer)

| Term | Value |
|------|--------|
| Discount | 40% off list price |
| Duration | 12 months from subscription start |
| Plans | Pro and Studio |
| Redemptions | **One per customer/account** (cannot redeem on both plans) |
| Transfer | Non-transferable |
| Availability | Until campaign cap reached or offer ended |
| After 12 months | Subscription renews at standard list price |

List prices: `PRICING_COPY` in [lib/marketing/copy/terminology.ts](../lib/marketing/copy/terminology.ts) ($69 Pro, $199 Studio).

---

## Economics (40% × 12 months)

| Plan | List / mo | Effective / mo | Year 1 at discount | Year 1 at list |
|------|-----------|----------------|--------------------|----------------|
| Pro | $69 | ~$41.40 | ~$497 | ~$828 |
| Studio | $199 | ~$119.40 | ~$1,429 | ~$2,388 |

Same marketing name for both plans. Two Stripe coupons scoped to each product/price.

---

## Stripe objects (test + live)

Create matching objects in **test** first; mirror in **live** before real charges.

| Object | Internal ID | Notes |
|--------|-------------|--------|
| Coupon (Pro) | `founder_pro_40_12m` | 40% off, repeating, 12 months |
| Coupon (Studio) | `founder_studio_40_12m` | 40% off, repeating, 12 months |
| Promotion code (Pro) | `FOUNDER40` | Customer-enterable; scoped to Pro price |
| Promotion code (Studio) | `FOUNDERSTUDIO40` | Customer-enterable; scoped to Studio price |

**Coupon settings:**

- `percent_off`: 40
- `duration`: `repeating`
- `duration_in_months`: 12
- `max_redemptions`: e.g. 500 per coupon (campaign cap; adjust in Dashboard)
- Apply to correct **Product** / **Price** ($69 Pro, $199 Studio)

**Env vars (app):**

- `STRIPE_FOUNDER_PRO_PROMOTION_ID` — promotion code ID for Pro
- `STRIPE_FOUNDER_STUDIO_PROMOTION_ID` — promotion code ID for Studio

Document created IDs in [stripe-setup.md](./stripe-setup.md).

---

## Checkout attachment rules

1. Founder discount applies at **checkout**, not at waitlist join.
2. While `PAID_OPEN=false`, checkout is disabled; waitlist only.
3. When `PAID_OPEN=true`:
   - Auto-apply founder promotion if user eligible and offer active
   - Or `allow_promotion_codes: true` with `FOUNDER40` / `FOUNDERSTUDIO40`
4. Persist `offer_id: founder_40_12m` in Checkout Session and Subscription metadata.
5. DB: `User.founderOfferRedeemedAt` or waitlist `convertedAt` — block second redemption.

**One redemption per customer:** If a user already redeemed founder offer on any plan, deny second checkout with founder discount.

---

## Waitlist relationship

Waitlist captures **intent** before checkout opens. Founder offer is communicated at waitlist join and in invite emails. Redemption happens only at successful paid subscription.

---

## Legal

Public terms must reference this offer. See [legal-launch-checklist.md](./legal-launch-checklist.md) and `/terms`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-01 | 12-month 40% cohort; supersedes “no founding offers” in business-model for this campaign. |
