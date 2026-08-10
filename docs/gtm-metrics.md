# GTM launch metrics

**Status:** Measurement definitions for hybrid launch + launch-tier campaign (August 2026).

**Strategy:** [gtm-launch-strategy.md](./gtm-launch-strategy.md)

---

## Funnel

```mermaid
flowchart LR
  V[Visitors] --> R[Review_started]
  R --> S[Signup_claim]
  S --> C[Report_completed]
  C --> L[Loop_action]
  L --> WPro[Waitlist_Pro]
  L --> WStudio[Waitlist_Studio]
  WPro --> I[Waitlist_invite]
  WStudio --> I
  I --> Pay[Checkout_paid]
  Pay --> Ret[Retention_30d]
```

| Stage | Definition | Source |
|-------|------------|--------|
| Visitor | Session on marketing site | GA4 / `MarketingPageViewTracker` |
| Review started | Audit enqueued (anon or signed-in) | `lib/analytics/events.ts`, audit create |
| Signup / claim | Account created or anon report claimed | auth + claim flow |
| Report completed | Audit status `COMPLETED` | Prisma `Audit` |
| Loop action | Copy fix prompt or update review run | analytics events |
| Waitlist Pro | `PaidPlanWaitlistEntry` plan `BUILDER` | DB |
| Waitlist Studio | `PaidPlanWaitlistEntry` plan `TEAM` | DB |
| Invite / batch grant | `invitedAt` set on waitlist row | DB / admin |
| Checkout | `started_checkout` / `completed_checkout` | analytics + Stripe webhook |
| Retention | Second review or active 30d post-pay | DB |

---

## Product Hunt success (mid-funnel)

Do not use waitlist count alone.

| Metric | Why |
|--------|-----|
| Reviews completed (PH week) | Wedge works |
| Free signups | Value worth saving |
| Pro waitlist joins | Pro payment intent |
| Studio waitlist joins | Studio payment intent |
| Qualified waitlist | Waitlist + ≥1 completed report |

**Example “ads ready” bar:** 200+ completed free reports, 30+ total waitlist, majority qualified, batch 1 waitlist→paid > ~10% on qualified cohort.

---

## Waitlist DB fields (admin)

| Field | Purpose |
|-------|---------|
| `userId` | Account |
| `plan` | `BUILDER` or `TEAM` |
| `joinedAt` | PH / campaign timing |
| `source` | pricing, dashboard, plan_picker, product_hunt, etc. |
| `campaign` | e.g. `launch_tier_2026` |
| `discountTier` | 1 (25%), 2 (15%), or null |
| `invitedAt` | Batch invite sent |
| `convertedAt` | Paid subscription started |

**Usage joins (segmentation):**

- `auditsUsed` / `auditsLimit` on `User`
- Completed audit count
- `creditsExhausted` derived: `auditsUsed >= auditsLimit` (free) or monthly cap hit (paid)

---

## Analytics events

| Event | Payload | When |
|-------|---------|------|
| `waitlist_joined` | `plan`, `source` | Waitlist DB upsert success |
| `beta_interest_submitted` | `plan`, `email` | Legacy alias; keep for dashboards |
| `started_checkout` | `plan`, `is_logged_in` | Checkout initiated (`PAID_OPEN=true`) |
| `completed_checkout` | `plan` | Stripe success / dashboard toast |
| `viewed_pricing` | — | Pricing page |

---

## Stripe reporting

- Track list vs discount by `discountTier` / promotion codes.
- Discount attribution by checkout metadata and `offer_id` migration checks.
- MRR at discount vs list (Dashboard / exports).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-04 | Replaced founder offer metrics with launch-tier funnel and discount-tier segmentation. |
