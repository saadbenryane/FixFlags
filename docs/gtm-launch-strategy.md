# GTM launch strategy

**Status:** Approved direction (August 2026). Hybrid free product + paid waitlist + founder offer cohort.

**Related:** [founder-offer.md](./founder-offer.md), [gtm-metrics.md](./gtm-metrics.md), [legal-launch-checklist.md](./legal-launch-checklist.md), [product-prd.md](./product-prd.md).

---

## Launch model

**Hybrid PLG + controlled monetization:**

| Layer | Behavior |
|-------|----------|
| **Free** | Full product within plan quotas. Not a crippled demo. |
| **Anon** | Homepage teaser: paste URL, evidence, one demonstrated fix prompt (see [PRODUCT.md](../PRODUCT.md)). |
| **Paid (Pro / Studio)** | While `PAID_OPEN=false`: upgrade CTAs → **separate waitlists** per plan. |
| **Paid open** | `PAID_OPEN=true`: public Stripe checkout; founder discount until campaign caps. |

Do **not** replace the homepage with a waitlist-only landing page. Primary CTA remains **Review my product**.

---

## Separate waitlists

- **Pro waitlist** (`BUILDER` plan enum)
- **Studio waitlist** (`TEAM` plan enum)

A user may join both. Each row is unique per `userId + plan`.

Waitlist join uses the signed-in account email (prefilled, read-only in UI). Confirmation: on the list; we email when paid checkout opens — not instant fake beta access.

---

## Founder offer (summary)

Marketing name: **40% Founder Discount**.

- **40% off for 12 months** on Pro and Studio list price
- **One redemption per customer/account** (terms + Stripe + DB)
- Campaign caps via Stripe `max_redemptions` per coupon (e.g. 500 each plan)
- **No public live counter** on the website

Full terms and Stripe objects: [founder-offer.md](./founder-offer.md).

---

## `PAID_OPEN` flag

| Value | Paid CTAs |
|-------|-----------|
| `false` (launch default) | Pro/Studio → waitlist form |
| `true` | Pro/Studio → Stripe checkout (founder offer when eligible) |

Env: server `STRIPE_PAID_OPEN`, client `NEXT_PUBLIC_PAID_OPEN`.

Flip to `true` when business registration, live Stripe, and support are ready — not before dogfood on batch 1.

---

## Go-to-market sequence

1. **Documentation + test Stripe** — founder coupons, waitlist schema, gating UI (this initiative).
2. **Product Hunt** — free try primary; Pro/Studio waitlist + founder offer in maker story.
3. **Measure** — reviews completed, Pro waitlist, Studio waitlist, qualified cohort (see [gtm-metrics.md](./gtm-metrics.md)).
4. **Business + live Stripe** — entity, live prices at $69 / $199, webhook.
5. **Batch 1 invite** — manual email to qualified waitlist; then flip `PAID_OPEN=true`.
6. **Ads** — only after batch 1 waitlist→paid conversion is acceptable.

---

## Product Hunt narrative

One line:

> Paste your URL free. See every Flag with evidence. Pro and Studio open in batches — **40% Founder Discount for 12 months** for early waitlist.

PH page: real report proof; primary CTA = try free; secondary = join Pro or Studio waitlist.

---

## Segmentation (batch invites)

| Segment | Definition | Action |
|---------|------------|--------|
| Power + waitlist | Used credits heavily + on waitlist | Batch 1 invite |
| Power, no waitlist | Used credits, did not join | Nurture to waitlist |
| Waitlist, low usage | On waitlist, barely reviewed | Nurture or defer |
| Active free | Mid usage | Let loop run |

Manual invites for now. Automate from DB segments later.

---

## What we rejected

- Homepage replaced by waitlist-only gate
- Lifetime founder discounts
- Public “spots left” counters
- Waitlist for signup (only for paid checkout)
- Ads before PH + batch 1 conversion signal

---

## Dependencies

- Billing metering aligned with marketing: `lib/billing/plans.ts`, `lib/audit/usage.ts`, `scripts/billing-plans-guard.mjs`.
- Live Stripe prices must match marketing $69 / $199 ([terminology.ts](../lib/marketing/copy/terminology.ts)).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-01 | Hybrid launch + founder cohort documented from GTM brainstorming. |
