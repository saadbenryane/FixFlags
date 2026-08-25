# GTM launch strategy

**Status:** Approved direction (August 2026). Hybrid free product + paid waitlist + launch-tier campaign.

**Related:** [founder-offer.md](./founder-offer.md) (historical), [gtm-metrics.md](./gtm-metrics.md), [legal-launch-checklist.md](./legal-launch-checklist.md), [product-prd.md](./product-prd.md).

---

## Launch model

**Hybrid PLG + controlled monetization:**

| Layer | Behavior |
|-------|----------|
| **Free** | Public report teaser with evidence and one focused fix prompt; no paywall before first value. |
| **Anon** | Homepage teaser: paste URL, review, and one sample fix prompt (see [PRODUCT.md](../PRODUCT.md)). |
| **Paid (Pro / Studio)** | While `PAID_OPEN=false`: upgrade CTAs route to **plan-specific waitlists**. |
| **Paid open** | `PAID_OPEN=true`: public Stripe checkout; launch-tier discount applied when eligible. |

Do **not** replace the homepage with a waitlist-only landing page. Primary CTA remains **Review my product**.

---

## Separate waitlists

- **Pro waitlist** (`BUILDER` plan enum)
- **Studio waitlist** (`TEAM` plan enum)

A user may join both. Each row is unique per `userId + plan`.

Waitlist join uses the signed-in account email (prefilled, read-only in UI). Confirmation: on the list; paid access is opened by batch or invite, not by fake beta gates.

---

## Launch-tier discount model (active)

Pricing campaign is **25% / 15% over 12 months**:

- positions 1..500 per plan -> 25% off for 12 months,
- positions 501..1000 per plan -> 15% off for 12 months,
- beyond 1000 -> list price.

This model replaces the retired founder offer and is enforced by `lib/billing/discount-tiers.ts` + `docs/stripe-setup.md`.

---

## `PAID_OPEN` flag

| Value | Paid CTAs |
|-------|-----------|
| `false` (launch default) | Pro/Studio → waitlist form |
| `true` | Pro/Studio → Stripe checkout (tier discount if position eligible) |

Env: server `STRIPE_PAID_OPEN`, client `NEXT_PUBLIC_PAID_OPEN`.

Flip to `true` when business registration, live Stripe, and support are ready; after at least one dogfood conversion batch.

---

## Go-to-market sequence

1. **Documentation + test Stripe** — launch-tier model, waitlist schema, and checkout gating.
2. **Product Hunt** — free try primary; paid plans + tiered launch discount in maker story.
3. **Measure** — reviews completed, waitlist progression, qualified conversion.
4. **Business + live Stripe** — entity, live prices at $29 / $79, webhook.
5. **Batch 1 invite** — manual or automated from qualified cohort; then flip `PAID_OPEN=true`.
6. **Ads** — only after batch 1 waitlist→paid conversion is acceptable.

---

## Product Hunt narrative

One line:

> Paste your URL free. See every Flag with evidence. Pro and Studio open in batches with launch-tier discounts for early waitlist cohorts.

PH page: real report proof; primary CTA = review my product; secondary = join Pro or Studio waitlist.

---

## Segmentation (batch invites)

| Segment | Definition | Action |
|---------|------------|--------|
| Power + waitlist | Used credits heavily + on waitlist | Batch 1 invite |
| Power, no waitlist | Used credits, did not join | Nurture to waitlist |
| Waitlist, low usage | On waitlist, barely reviewed | Nurture or defer |
| Active free | Mid usage | Keep loop flowing |

Manual invites for now. Automate from DB segments later.

---

## What we rejected

- Homepage replaced by waitlist-only gate
- Retired founder-offer-style 40% flat campaign for launch
- Public “spots left” counters
- Waitlist for signup (only for paid checkout)
- Ads before PH + batch 1 conversion signal

---

## Dependencies

- Billing metering aligned with marketing: `lib/billing/plans.ts`, `lib/audit/usage.ts`, `scripts/billing-plans-guard.mjs`.
- Launch-tier discount metadata: `lib/billing/discount-tiers.ts`, `lib/billing/waitlist.ts`.
- Live Stripe prices must match marketing $69 / $199 ([terminology.ts](../lib/marketing/copy/terminology.ts)).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-04 | Launch-tier discount model (25% / 15%) replaces 40% founder cohort messaging. |
