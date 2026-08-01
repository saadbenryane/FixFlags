# Legal launch checklist

**Status:** Working checklist for GTM + founder offer launch (August 2026).

**Offer terms:** [founder-offer.md](./founder-offer.md)

---

## Public legal surfaces

| Surface | Path | Status | Required updates |
|---------|------|--------|------------------|
| Terms of Service | `/terms` | **Shipped Aug 2026** | Founder Discount, waitlist, metering |
| Privacy Policy | `/privacy` | **Shipped Aug 2026** | Waitlist email, Stripe billing/tax |
| Pricing copy | `lib/marketing/copy/plans.ts` | **Shipped** | Waitlist + founder wording |
| FAQ | `lib/marketing/copy/plans.ts` | Review | Founder offer pointer |
| Footer links | site footer | Verify | Terms + Privacy linked |
| Cookie policy | — | **Missing** | Optional future page; note analytics cookies in privacy if needed |
| Sign-up terms acceptance | auth flows | Review | Link to terms if not present |

---

## Founder offer (terms must cover)

- [x] Name: 40% Founder Discount
- [x] 40% off for 12 months on Pro or Studio
- [x] One redemption per customer/account (not both plans)
- [x] Non-transferable
- [x] Subject to availability / campaign cap
- [x] Standard price after promotional period
- [x] No stacking with other offers

---

## Waitlist

- [x] Email used to notify when paid plans open
- [x] No guarantee of timing or admission
- [x] Free account remains available while on waitlist

---

## Billing (existing + launch)

- [x] Monthly subscription renewal
- [x] Cancel via Stripe portal
- [x] Product review limits per plan (enforced in `lib/billing/plans.ts`)
- [x] Update reviews use product review credits (enforced in `lib/audit/monitoring.ts`)

---

## Internal canon alignment

| Doc | Action |
|-----|--------|
| [knowledge/privacy.md](../knowledge/privacy.md) | Align if public privacy changes materially |
| [DECISIONS.md](../DECISIONS.md) | Row for hybrid launch + founder offer |
| [docs/business-model.md](./business-model.md) | Founder cohort vs “no founding offers” |

---

## Sign-off

| Item | Owner | Date |
|------|-------|------|
| Terms updated | | |
| Privacy updated | | |
| Copy drift check pass | | |
| Founder offer live in Stripe test | | |
| Live flip after business registration | | |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-01 | Initial checklist for GTM launch. |
