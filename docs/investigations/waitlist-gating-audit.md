# Waitlist / Paid-Plan Gating Audit

**Scout:** read-only investigation of paid-plan gating, waitlist, invite, and launch-day operations.
**Date:** 2026-08-04
**Repo:** /Users/saadbenryane/Code/qewos @ `main` (c9225251)
**Scope:** join flow, gating coverage, founder offers, invites, 500/500 cohorts, admin ops, P0 ship blockers, launch runbook.

---

## 1. Executive summary

The paid-plan waitlist system is **real, wired end-to-end, and correctly gated**. When `STRIPE_PAID_OPEN=false` (the current default, and the local `.env.local` state), **every** path to Stripe checkout is blocked — client UI gates on `NEXT_PUBLIC_PAID_OPEN` and the single checkout API route re-gates server-side on `STRIPE_PAID_OPEN`. There is no un-gated path to pay before batch 1.

What exists:

- **Join flow:** signed-in users join a per-plan waitlist (Pro = `BUILDER`, Studio = `TEAM`) via `WaitlistJoinForm` → `POST /api/stripe/waitlist` → `PaidPlanWaitlistEntry` upsert (unique per `userId+plan`). Confirmation email + admin notification email (Resend) are sent on join.
- **Gating:** `paid-open.ts` (server `STRIPE_PAID_OPEN`, client `NEXT_PUBLIC_PAID_OPEN`), enforced in `pick-plan.ts` (all UI), `PricingCTAButton`, `UpgradeButton`, `PlanPickerDialog`, and `POST /api/stripe/checkout` (403 `PAID_CHECKOUT_CLOSED`).
- **Founder offer:** 40% for 12 months, one redemption per account, **waitlist membership required** (DB check), coupon `max_redemptions` cap of 500 per plan configured in Stripe.
- **Admin:** `/admin/waitlist` — counts, plan filter, CSV export, per-row "Mark invited" (sets `invitedAt` + sends invite email), usage segments (power/low usage), converted tracking via Stripe webhook.

What does **not** exist:

- **No user-facing invite mechanism.** No invite codes, no referral links, no "invite a friend" flow anywhere in schema, lib, app, or components. "Invite" today is purely an admin email action; it grants nothing.
- **No 500/500 cohort concept.** No batch field, no cohort assignment, no access-window, no batch-2 logic in code or docs. The only "batch" content is (a) GTM copy "open in batches", (b) a manual "Batch 1 invite → flip PAID_OPEN" sequence in `docs/gtm-launch-strategy.md`, and (c) Stripe `max_redemptions: 500` as the only scarcity mechanism.
- **No email capture pre-account.** Waitlist join requires a signed-in session (401 otherwise). Anonymous visitors are routed to sign-up first. A separate, email-only **newsletter** list exists (`NewsletterSubscriber` + `POST /api/newsletter/subscribe`) but it is not connected to the waitlist.

**Net:** the current model is "one global gate + founder coupon cap", not "batch-gated access". Shipping a credible "first 500, then next 500" launch requires building a cohort/batch layer: a batch or grant field, per-user access checks at checkout, bulk invite tooling, and a batch-2 flip.

---

## 2. Join flow: what's captured, who can join

**Path:** `WaitlistJoinForm` (components/billing/WaitlistJoinForm.tsx) → `submitWaitlistJoin` (lib/billing/client-checkout.ts) → `POST /api/stripe/waitlist` (app/api/stripe/waitlist/route.ts) → `upsertPaidPlanWaitlistEntry` (lib/billing/waitlist.ts).

**Who can join:** signed-in users only. The API route rejects anonymous visitors with `401 { code: 'UNAUTHORIZED', action: 'sign_in' }`. In the UI:

- `PricingCTAButton` for a logged-out user pushes to `signUpHref` (`/sign-up?plan=…`) — waitlist form is never shown anonymously.
- After sign-up, `PlanPickerDialog` (post-login plan picker) funnels to the same `pickPlan` gate; a waitlist pick routes to `/pricing` where the form renders.
- `UpgradeButton` (dashboard) only renders for signed-in users.

**What's captured:**

| Field | Source | Notes |
|---|---|---|
| `userId` | session | FK to User (cascade delete) |
| `plan` | form (BUILDER/TEAM) | Pro/Studio, join both allowed |
| `source` | form (pricing/dashboard/…) | optional, ≤64 chars |
| `campaign` | defaults to `founder_40_ph_2026` | optional override |
| `founderOfferId` | hardcoded `founder_40_12m` on create | set on every join |
| `joinedAt` | default now | |
| `invitedAt` | admin action only | |
| `convertedAt` | Stripe webhook (`subscription created`, paid status) | only for BUILDER/TEAM |
| email | session (`session.user.email`) | the form's email input is cosmetic for logged-in users (locked/read-only when `initialEmail` passed) |

**Emails on join:** confirmation to the user (`WAITLIST_EMAILS.joined`) + notification to `ADMIN_NOTIFICATION_EMAIL` (includes a link to `/admin/waitlist`).

**Gaps vs "newsletter-style capture + invites":**

1. **No pre-account capture.** Anonymous visitors must create an account to join the waitlist — no email-only join. The standalone newsletter list (`NewsletterSubscriber`, footer form) captures email pre-account but is a separate, non-waitlist list with no path to join the paid waitlist. If the intent is to capture anonymous visitors, the waitlist route needs an email-only mode (new model or nullable userId), and the join CTA for logged-out users should present the form rather than only sign-up.
2. **No referrer tracking** beyond a single free-form `source` string (no UTM persistence, no invite attribution).
3. **Waitlist and newsletter are disconnected** — no merge/dedupe, no shared opt-in semantics.
4. The form's `name` field is accepted by the API schema but never sent by the client (always `''`), and is unused server-side.

---

## 3. Gating coverage: every checkout path

Gate primitives:

- Server: `isPaidOpenServer()` = `process.env.STRIPE_PAID_OPEN === 'true'` (lib/billing/paid-open.ts)
- Client: `isPaidOpenClient()` = `process.env.NEXT_PUBLIC_PAID_OPEN === 'true'`; `isPaidCheckoutGatedClient()` = `!isPaidOpenClient()`
- Central decision tree: `pickPlan()` (lib/billing/pick-plan.ts) — `waitlistGated` short-circuits before any checkout fetch.

| # | Path | Gated when closed? | Mechanism |
|---|---|---|---|
| 1 | Pricing page Pro/Studio CTA (`PricingCTAButton`) | ✅ Yes | `waitlistGated` default = `isPaidCheckoutGatedClient()` → form; plus server gate if it slips through |
| 2 | Dashboard `UpgradeButton` | ✅ Yes | `waitlistGated` default = `isPaidCheckoutGatedClient()` → form before fetch |
| 3 | `ContextualUpgradeCard` (dashboard limit, compare page) | ✅ Yes | funnels through `PricingCTAButton` → `pickPlan` |
| 4 | Post-login `PlanPickerDialog` (`/onboarding/plans`) | ✅ Yes | `waitlistGated: isPaidCheckoutGatedClient()` → redirects to `/pricing` for waitlist form |
| 5 | `POST /api/stripe/checkout` (the only checkout API) | ✅ Yes | hard server check: 403 `PAID_CHECKOUT_CLOSED` if `!isPaidOpenServer()` |
| 6 | Billing page (`app/(app)/billing/page.tsx`) | ✅ N/A | no checkout entry point; subscription/credits management only |
| 7 | `POST /api/stripe/credit-pack` | ✅ Transitively | requires `user.plan !== 'FREE'` (403 `PLAN_UPGRADE_REQUIRED`); can't be paid-plan without passing the checkout gate. ⚠️ Not keyed off `PAID_OPEN` itself — a revoked/cancelled paid subscriber retains a non-FREE plan and could buy credit packs. Low risk, worth a note. |
| 8 | Stripe Customer Portal (`/api/stripe/portal`) | ✅ N/A | only for existing subscriptions; no new-money path |
| 9 | CLI / MCP | ✅ N/A | CLI calls public API (`/api/checks`, report routes); no checkout tool in `lib/mcp/tools.ts` |
| 10 | Founder discount auto-apply (`founderCheckoutDiscounts`) | ✅ Yes | `isFounderOfferEligible` returns false when `!isPaidOpenServer()` and requires waitlist row + `founderOfferRedeemedAt == null` |

**Conclusion: no un-gated path to pay before batch 1.** All six checkout-capable UI surfaces funnel through `pickPlan` and/or the server-side 403.

**Soft-gate caveat (founder discount):** when paid is open, non-waitlist users get `allow_promotion_codes: true` on the checkout session. The founder promotion codes (`FOUNDER40` / `FOUNDERSTUDIO40`) are documented as "customer-enterable" (`docs/founder-offer.md`). So a non-waitlist user who knows the code could apply it even though auto-application requires waitlist membership. The DB eligibility gate only controls automatic application. If waitlist membership must be the strict requirement, either restrict the promotion codes in Stripe (e.g., no customer-enterable use; apply only server-side) or stop passing `allow_promotion_codes` for non-waitlist users. Stripe's `max_redemptions: 500` limits total damage, but this is the one real "gate" that is not airtight.

---

## 4. Invites: does not exist as a user feature

Searched: `prisma/schema.prisma`, `lib/`, `app/`, `components/`, `docs/`, `knowledge/`, `ROADMAP.md`, `PRODUCT.md`, `DECISIONS.md` for invite / invite-code / referral / ref-link / share-access mechanisms.

**Findings:**

- **No schema:** no `Invite`, `InviteCode`, `WaitlistInvite`, referral, or batch model. `PaidPlanWaitlistEntry.invitedAt` is the only "invite" data point.
- **No user-facing flow:** no "invite a friend", no share link, no code redemption route, no referral page/component.
- **The only "invite" is admin→waitlist-member email:** `POST /api/admin/waitlist/[id]/invite` sets `invitedAt` and sends `WAITLIST_EMAILS.invited` ("<Plan> checkout is open for you"). It grants **nothing** — no access, no code, no per-user flag. It is an announcement email only. When `PAID_OPEN=true`, *everyone* (waitlist or not) can check out; the invite email is informational.
- `knowledge/execution.md` lists "Studio nurture / referral program" as future work; `docs/growth/backlog.md` has no invite item.

**Minimal invite system design (if the Captain's intent is "invitees get access"):**

1. **Schema:** `WaitlistInvite` model: `{ id, inviteeEmail, inviterUserId (nullable for system/bulk), plan, batch (Int 1|2), status (PENDING|JOINED|REVOKED), code (unique, short), invitedAt, redeemedAt, joinedUserId? }`. Optionally add `batch Int?` and `accessGrantedAt DateTime?` to `PaidPlanWaitlistEntry`.
2. **Join flow:** "Invite" button in dashboard/admin → generates unique code + share link (`/join?code=…&plan=…`). Landing page: if signed-in, upsert waitlist entry with `batch` + `accessGrantedAt`; if anonymous, capture email (pre-account!) then attach on signup (like the anon-report claim flow).
3. **Access grant:** server-side check at `/api/stripe/checkout` — require `accessGrantedAt` (or batch ≤ open batch) before creating the session, replacing the global `isPaidOpenServer()` flip for invited cohorts.
4. **Attribution:** invite email → join → checkout → `convertedAt` chain so the inviter can be tracked.

---

## 5. 500/500 cohorts: does not exist

Searched `ROADMAP.md`, `docs/year-1-operating-plan.md`, `docs/gtm-launch-strategy.md`, `docs/gtm-metrics.md`, `docs/founder-offer.md`, `knowledge/`, `PRODUCT.md`, `DECISIONS.md`, AGENTS.md for cohort / batch / 500 / phase / access window.

**What exists:**

- GTM copy: "Pro and Studio open in batches" (`lib/marketing/copy/plans.ts` `gatedHint`); waitlist email: "we open paid checkout in batches".
- `docs/gtm-launch-strategy.md`: sequence item "**Batch 1 invite** — manual email to qualified waitlist; then flip `PAID_OPEN=true`" and a segmentation table (Power + waitlist → Batch 1 invite; others → nurture/defer). **No Batch 2 defined.**
- `docs/founder-offer.md`: coupon `max_redemptions: 500` per plan (campaign cap). This is a *discount* cap, not an access cap.
- `docs/year-1-operating-plan.md`: "~500 Pro / ~80–100 Studio" customers as year-1 targets (pricing figures there are stale $39/$129; GTM + marketing say $69/$199).
- `knowledge/launch-requirements.md` "Cohort" section = the 20-solo-builder/10-agency/5-team validation cohort, unrelated to batch access.

**What's missing to implement "first 500 then next 500":**

1. **Batch assignment** — no `batch`/`cohort` field on `PaidPlanWaitlistEntry`; "position" is only inferable from `joinedAt` ordering (per plan), which the admin CSV can produce today.
2. **Per-batch access grant** — checkout is global. Batch 1 access means only batch-1 members can reach Stripe; needs a grant field + server-side check (see §4).
3. **Batch-2 release mechanism** — a second flip (env flag, admin button, or auto-release when batch 1 count/conversion threshold met) plus email to batch 2.
4. **Admin release tooling** — bulk invite (batch 1 = first 500 `joinedAt` per plan, filtered to qualified segment), batch assignment UI, release-state indicator.
5. **Copy/education** — "500 first, 500 second" needs customer-facing truth (are positions public? ranked? the GTM doc rejects public "spots left" counters — keep that decision).
6. **Concurrency guard** — joining happens in bursts (PH launch); "first 500" requires an atomic counter or reservation per plan to avoid overshoot.

---

## 6. Admin ops today vs needed for batch release

**Today (`app/admin/waitlist/page.tsx`, `WaitlistTable`, `lib/billing/waitlist-segments.ts`, export route):**

| Capability | Status |
|---|---|
| Counts by plan | ✅ Pro / Studio totals + filters |
| List rows (email, plan, joined, source, usage, segment) | ✅ ordered by `joinedAt desc` |
| CSV export (filtered by plan) | ✅ |
| Per-row "Mark invited" (sets `invitedAt`, sends invite email) | ✅ — one at a time |
| Usage segments (power_waitlist / waitlist_low_usage / power_no_waitlist / active_free) | ✅ computed |
| Converted tracking (via Stripe webhook → `convertedAt`) | ✅ |
| Bulk invite | ❌ manual per-row only |
| Batch assignment (1 or 2) | ❌ no concept |
| Bulk grant / per-batch access open | ❌ no concept |
| Release-state dashboard (how many granted/converted per batch) | ❌ |
| Invite code generation / share links | ❌ |

**Needed for a batch-1/500 + batch-2/500 launch:** bulk-select rows → assign batch → generate invites (email with direct link) → track per-batch open/conversion → admin toggle to "open batch N" (which flips the server gate from global `PAID_OPEN` to per-user grant) → batch-2 automation when batch 1 conversion threshold met.

---

## 7. Ship blockers: INVESTIGATION_REPORT.md P0 cross-check

P0 list source: `INVESTIGATION_REPORT.md` §5 (untracked working doc, sections 255–281). Cross-checked against current `main` (c9225251, 2026-08-04).

| # | P0 item | Status now | Evidence |
|---|---|---|---|
| 1 | Complete npm Trusted Publisher Release (provenance) | 🟡 **Mostly done** | `fixflags` v1.0.4 published; `latest` dist-tag = 1.0.4 (verified via npm registry, modified 2026-08-04). `.github/workflows/publish-cli.yml` uses OIDC (`environment: npm`, `id-token: write`) = trusted publishing. **But:** `npm publish` runs without `--provenance` (commit 31a46d08 "remove provenance flag for private repo"), so the provenance-attestation sub-item is explicitly dropped; stale dist-tags remain (`bootstrap: 0.0.0`, `beta: 1.0.0`). Publish workflow verified by CI (verify + publish + registry check jobs). |
| 2 | Credentialed Lovable/Bolt connector smokes | 🔴 **Open** | `lib/integrations/editor-catalog.ts` catalogs lovable + bolt; `e2e/credentialed-journeys.spec.ts` harness exists (gated on `E2E_CREDENTIALED`). **But** `docs/integrations/` does not exist (no code-backed catalog), and no evidence of completed credentialed production smokes. ROADMAP: "Credentialed production smokes for newly cataloged editors remain required before expanding the verified shipped-integration claim." |
| 3 | Freeze accuracy regression fixtures (visual baselines in `accuracy:eval`) | 🔴 **Open** | `npm run accuracy:eval` exists (`scripts/accuracy-eval.ts`, corpus `lib/audit/accuracy-corpus.ts`); capture/adjudicate scripts exist (`accuracy:capture-fixtures`, `accuracy:adjudicate`). No visual/pixel-baseline regression gate found; no screenshot baseline artifacts for the corpus (checked `scripts/`, `lib/audit/`, root-level visual files). |
| 4 | Complete API route contract tests | 🟢 **Substantially done** | Handler-level `__tests__/route.test.ts` present for: stripe checkout+portal, stripe waitlist, webhooks (stripe, railway), checks, health, cron, tools (MCP), me, api-keys, cli auth/release, reports ([id], status, retry, re-check, chat, feedback, share-links, toggle-public), projects + scan-access + watch, admin support sessions. Billing/auth/share/webhook/MCP priority list is covered. |
| 5 | `/api/reports/[id]/re-check` → `update-review` rename | 🔴 **Open but deliberately de-scoped** | Route is still `app/api/reports/[id]/re-check`; no `update-review` route. CLI (`fixflags recheck`, `ff_recheck_and_compare`) and MCP keep `recheck` naming. **However**, AGENTS.md (canonical, newer) explicitly states: "Internal code may still use `re-check`, `recheck`, and `monitoring` routes and analytics names" — customer copy uses "update review" via `lib/marketing/copy/terminology.ts` (`updateReview`/`updateReviews` terms + banned-pattern regexes). The public-API rename as originally written (migrate route + CLI + docs) is **not done**; the current decision defers it to "internal-only naming". If the P0 intent was a customer-visible route change, that is no longer required; if it was API-shape cleanup, it remains open. |

**Other relevant readiness signals:**

- `e2e/public-journeys.spec.ts` asserts pricing shows `$69` / `$199` ✅ (ph-readiness smoke item).
- `scripts/billing-plans-guard.mjs` exists (billing/marketing alignment guard) ✅.
- `docs/ph-readiness-smoke.md` defines the paid-open operator checklist (waitlist form, join email, admin invite, founder promo eligibility, webhook redemption, metering, anon wedge, live Stripe, business entity) — most is code-complete; the live/business items are external.
- Untracked working files in tree: `INVESTIGATION_REPORT.md`, `.agents/sessions/pi-agent-e2e-test-*.md`, `scripts/growth/pull-both-sites.{mjs,ts}` (uncommitted, minor).

---

## 8. Production env readiness (key presence only — no secret values)

`.env.example` declares: `STRIPE_PAID_OPEN`, `NEXT_PUBLIC_PAID_OPEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BUILDER_PRICE_ID`, `STRIPE_TEAM_PRICE_ID`, `STRIPE_FOUNDER_PRO_PROMOTION_ID`, `STRIPE_FOUNDER_STUDIO_PROMOTION_ID`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_CREDIT_PACK_*`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `R2_*` (ACCOUNT_ID, BUCKET_NAME, ACCESS_KEY_ID, SECRET_ACCESS_KEY, PUBLIC_URL).

Local `.env.local` (presence/mode only):

| Var | Local state |
|---|---|
| `STRIPE_PAID_OPEN` / `NEXT_PUBLIC_PAID_OPEN` | **Not set** → gate closed, waitlist mode active ✅ |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Set, **test mode** (`sk_test_` / `whsec_` prefix) |
| `STRIPE_BUILDER_PRICE_ID` / `STRIPE_TEAM_PRICE_ID` | Set (per stripe-setup.md, current test IDs are the $39/$129 legacy ones — **need replacing with $69/$199 for launch**) |
| `STRIPE_FOUNDER_PRO_PROMOTION_ID` / `STUDIO` | **Not set** → founder discount not configured locally |
| `STRIPE_PUBLISHABLE_KEY` | Not set locally |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Set ✅ (waitlist + newsletter email works locally) |
| `R2_*` | **Not set locally** (screenshots fall back; production Railway has R2 per stripe-setup.md) |
| `DATABASE_URL` | Postgres, present |

`docs/stripe-setup.md` "Deploy readiness" states production (Railway) has the full revenue path (DATABASE_URL, REDIS_URL, R2, OPENAI_API_KEY, PAGESPEED_API_KEY, auth URLs, RESEND, ADMIN_NOTIFICATION_EMAIL, full Stripe **test** set, `BILLING_REQUIRED=true`). Launch requires the **live** flip checklist there: live products/prices ($69/$199), live webhook, live keys, founder promotion IDs, one real smoke charge, rotate pasted keys.

**Local gaps vs launch:** founder promotion IDs unset (founder offer inert), publishable key unset, price IDs still legacy $39/$129, R2 unset — all consistent with "not launched yet"; none of these block the waitlist mode.

---

## 9. Launch-day runbook + recommended order of operations

**Documented intent** (docs/gtm-launch-strategy.md §Go-to-market sequence + docs/stripe-setup.md "Live flip" + docs/ph-readiness-smoke.md):

1. Docs + test Stripe: founder coupons, waitlist schema, gating UI (done).
2. Product Hunt: free try primary; Pro/Studio waitlist + founder offer in maker story.
3. Measure: reviews completed, Pro/Studio waitlist, qualified cohort.
4. Business + live Stripe: entity, live prices $69/$199, live webhook.
5. **Batch 1 invite** — manual email to qualified waitlist; then flip `PAID_OPEN=true`.
6. Ads only after batch 1 waitlist→paid conversion is acceptable.

**Missing for a batch-1/500 + batch-2/500 invite-driven launch** (i.e., what the docs' "manual email + flip" cannot deliver):

1. **A real batch concept** — without it, flipping `PAID_OPEN=true` opens checkout to *everyone* (all waitlisters + non-waitlisters), not "batch 1". The founder coupon cap (500/plan) is the only brake, and it caps discounts, not access.
2. **Invite grant flow** — "invite others" needs an invite model + redeem + per-user access grant (§4). Today's invite email grants nothing.
3. **Batch release admin** — bulk assign + bulk email + release toggle + per-batch conversion dashboard (§6).
4. **First-500 atomicity** — burst-safe reservation per plan.
5. **Batch-2 trigger** — defined threshold (e.g., batch-1 conversion % or cap reached) + batch-2 email + second release.

**Recommended order of operations for a credible launch (with current code):**

1. **Close the P0-2/P0-3 gaps** (credentialed editor smokes + accuracy visual regression freeze) — they gate the "verified shipped" claim and scan quality, not the billing path.
2. **Replace legacy Stripe price IDs with $69/$199** (test first) and configure founder promotion IDs — the founder offer is currently inert without them.
3. **Decide the batch model** (per-user grant vs coupon-cap-only) — this is the single biggest product decision; everything in §4–§6 hangs off it. Recommended minimal: add `batch` + `accessGrantedAt` to `PaidPlanWaitlistEntry`, gate `/api/stripe/checkout` on grant instead of global flip, build bulk batch-assign admin.
4. **Add email-only waitlist capture** (pre-account) if anonymous capture matters for PH traffic; otherwise keep newsletter-only capture and wire newsletter→waitlist promotion later.
5. **Build invite flow** (schema + `/join` redeem + dashboard invite button) — minimum viable for "users invite others with same/next batch access".
6. **PH launch sequence:** free primary CTA → waitlist joins (measure qualified cohort) → business entity + live Stripe + founder promos → admin assigns batch 1 (first 500 per plan, power segment priority) → bulk invite email → release batch 1 (grant) → monitor conversion (ads-ready bar: 200+ completed reports, 30+ waitlist, >10% batch-1 paid on qualified) → batch 2 release when threshold met → then ads.

---

## Appendix: key files

| Area | Files |
|---|---|
| Join form / submit | `components/billing/WaitlistJoinForm.tsx`, `lib/billing/client-checkout.ts`, `app/api/stripe/waitlist/route.ts` |
| Waitlist data | `lib/billing/waitlist.ts`, `prisma/schema.prisma` (`PaidPlanWaitlistEntry`, `NewsletterSubscriber`) |
| Gating | `lib/billing/paid-open.ts`, `lib/billing/pick-plan.ts`, `app/api/stripe/checkout/route.ts`, `components/pricing/PricingCTAButton.tsx`, `components/dashboard/UpgradeButton.tsx`, `components/billing/PlanPickerDialog.tsx`, `components/billing/ContextualUpgradeCard.tsx` |
| Founder offer | `lib/billing/founder-offers.ts`, `docs/founder-offer.md`, webhook `app/api/webhooks/stripe/route.ts` |
| Admin | `app/admin/waitlist/page.tsx`, `components/admin/WaitlistTable.tsx`, `app/api/admin/waitlist/{export,[id]/invite}/route.ts`, `lib/billing/waitlist-segments.ts` |
| Newsletter | `app/api/newsletter/subscribe/route.ts`, `components/layout/FooterNewsletter.tsx`, `lib/email/send.ts` (`sendNewsletterConfirmation`), `lib/email/templates.ts` (`NEWSLETTER_EMAIL`, `WAITLIST_EMAILS`) |
| Launch docs | `docs/gtm-launch-strategy.md`, `docs/gtm-metrics.md`, `docs/founder-offer.md`, `docs/stripe-setup.md`, `docs/ph-readiness-smoke.md`, `docs/year-1-operating-plan.md`, `knowledge/launch-requirements.md`, `INVESTIGATION_REPORT.md` |
| P0 evidence | `.github/workflows/publish-cli.yml` (+ promote-latest, update-latest-dist-tag), `fixflags-cli/package.json` (v1.0.4), `e2e/credentialed-journeys.spec.ts`, `lib/integrations/editor-catalog.ts`, `scripts/accuracy-eval.ts` |
