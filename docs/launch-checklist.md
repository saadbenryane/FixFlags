# Launch checklist (paid plans flip)

**Verified (env inventory, O-2):** 2026-08-07 (UTC) · repo commit `451c52f` · live site `https://fixflags.com` (Railway project `FixFlags` / production / service `QewOS`; worker service `FixFlags Worker`).
**Method (O-2):** read-only `railway variables` (table + `--kv` raw), Stripe API price lookups (test key, GET only), `/api/health`, webhook route probe, and code inspection (`lib/billing/paid-open.ts`, `lib/billing/waitlist.ts`, `lib/billing/discount-tiers.ts`, `lib/billing/config.ts`). No secrets recorded; no changes made.

**Verified (code review + flip runbook, C-3):** working tree `HEAD 35cb36a8` · full read of the batch-gate path (`app/api/stripe/checkout/route.ts`, `app/api/stripe/waitlist/route.ts`, `app/api/webhooks/stripe/route.ts`, `lib/billing/{paid-open,waitlist,discount-tiers,client-checkout}.ts`, `app/api/admin/waitlist/[id]/invite/route.ts`) · unit tests `checkout-batch-gate.test.ts` + `waitlist-batch.test.ts` run green (26/26) · new `e2e/billing-gate.spec.ts` written (typecheck + lint clean; runs only when a test-mode app + env are provided — see its header). No code changes; nothing flipped; nothing committed.

## ASK-CAPTAIN (blocking before flip)

1. **Price IDs do not match the canonical shipped plan prices.** Verified via the Stripe API in test mode. Create matching test and live prices in the Stripe Dashboard before launch. See the current pricing table in [knowledge/strategy.md](../knowledge/strategy.md) and the operator steps in [stripe-setup.md](./stripe-setup.md).
2. **No promotion codes exist yet.** All four `STRIPE_TIER*_PROMOTION_ID` vars are UNSET. The 4 coupons/codes (T1PRO25, T1STUDIO25, T2PRO15, T2STUDIO15) must be created in Dashboard (test first, mirror live) before the flip; set the promo IDs in env.
3. **PLAN_RELEASE_DATE must be decided and must be ≤ launch day** (proposed 2026-09-01) — unset today means no discount window and no promotion applies at checkout. Verified in `discount-tiers.ts`: `isDiscountWindowActive()` requires `now ∈ [PLAN_RELEASE_DATE, +12 months)` — a future release date means **no discount is auto-applied even for tier-1 members** (list price). For test-mode verification before the chosen date, temporarily set a past date.
4. **Anthropic fallback is not configured** on either service (`ANTHROPIC_API_KEY` UNSET; health: chain `openai,anthropic` but `aiConfiguredProviders: ["openai"]`). Not blocking — OpenAI is primary — but the fallback is inert without it.
5. **Webhook secret is test-mode only** (`whsec_`, test). A new **live** endpoint + live `whsec_` on `https://fixflags.com/api/webhooks/stripe` is required for the flip (route verified live: unsigned POST → HTTP 400).

Not blocking, flagged: worker `GSC_SERVICE_ACCOUNT_KEY` is SET with length 1 (likely misconfigured; GSC/GA4 reporting on worker only — optional, not on the revenue path).

6. **Non-member checkout behavior needs a Captain decision.** Shipped code (`isCheckoutEligible(null) === true`, unit-tested) lets a user with **no waitlist row** check out whenever the master switch is on — legacy global-open behavior, intentional per code comments. The O-2 smoke doc and the flip task text expect "non-member gets 403", which is **not** what the code does. Options: **(1)** accept as-is (recommended — the launch cohort is waitlist members; stray non-members buy at list price; zero code change), or **(2)** require a waitlist row for all paid checkout (code + tests change — out of scope for the flip, do NOT do during the flip).

---

## VERIFIED FLIP RUNBOOK (Captain executes manually — every step **NEVER-AUTO**, no scripts, no agents, no auto-deploy)

Order matters: prices → promotion codes → env → live keys → verify. Test mode first, mirror in live. **Never mix test and live keys** (mode = key prefix). Every Stripe Dashboard action and every `railway variables set` below is operator-executed.

### Step 0 — Preconditions (code-verified, no action)
- Batch gate is complete end-to-end in code (see Code review below): waitlist join snapshots tier+batch by position; checkout enforces master switch → batch cohort → 403 `BATCH_ACCESS_REQUIRED`; tier promotion auto-applies for released members; promo codes are never customer-enterable; webhook sets entitlement; admin invite/grant path exists.
- Confirm ASK-CAPTAIN decisions #1, #2, #3, #6 before starting (prices, promos, release date, non-member behavior).

### Step 1 (a) — Prices in test AND live (Stripe Dashboard, manual) — **NEVER-AUTO / operator-executed**
1. Create recurring Pro and Studio prices matching the canonical shipped table in [knowledge/strategy.md](../knowledge/strategy.md), then assign new `STRIPE_BUILDER_PRICE_ID` and `STRIPE_TEAM_PRICE_ID` values in test before mirroring them in live.
2. Archive the mismatched test price objects and replace their environment values. Do not reuse old price objects for new amounts.
3. Existing credit-pack and expert-review test objects are outside the launch path. Keep them and mirror them to live only when first needed.

### Step 2 (b) — Promotion codes in test AND live (Stripe Dashboard, manual) — **NEVER-AUTO / operator-executed**
1. Create 4 **promotion codes** (internal coupon names per docs/stripe-setup.md):
   - `T1PRO25` / `T1STUDIO25` — **25% off**, repeating 12 months, `max_redemptions` 500, `redeem_by` = PLAN_RELEASE_DATE + 12 months.
   - `T2PRO15` / `T2STUDIO15` — **15% off**, repeating 12 months, `max_redemptions` 500, same `redeem_by`.
2. **Record the `promo_…` promotion-code IDs, NOT `coupon_…` IDs** — checkout passes them to `discounts[].promotion_code` (verified in `app/api/stripe/checkout/route.ts` → `tierCheckoutDiscounts`).
3. Test first, mirror in live.

### Step 3 (c) — Env on web service `QewOS` (Railway), then redeploy — **NEVER-AUTO / operator-executed**
| Variable | Value at flip | Why / trap |
|---|---|---|
| `STRIPE_PAID_OPEN` | `true` | Master switch (kill switch for all paid checkout). |
| `NEXT_PUBLIC_PAID_OPEN` | `true` | Client mirror — must match the server or CTAs stay gated. |
| `WAITLIST_OPEN_BATCH` | `1` | **Trap: unset defaults to 0 = no cohort can check out even with the master switch on.** |
| `PLAN_RELEASE_DATE` | `2026-09-01` (or chosen ISO date) | Unset/invalid = no discount window; must be ≤ launch day or the 25% off never applies. |
| `STRIPE_TIER1_PRO_PROMOTION_ID` | `promo_…` | T1PRO25 |
| `STRIPE_TIER1_STUDIO_PROMOTION_ID` | `promo_…` | T1STUDIO25 |
| `STRIPE_TIER2_PRO_PROMOTION_ID` | `promo_…` | T2PRO15 |
| `STRIPE_TIER2_STUDIO_PROMOTION_ID` | `promo_…` | T2STUDIO15 |
| `ANTHROPIC_API_KEY` | set a real key | **O-2 flagged MISSING** — fallback judge provider is in the chain but inert without it (pre-flip env item). |
| `WAITLIST_BATCH_SIZE` | leave unset | Default 500 is the launch plan; changing it changes access cohorts only, never the 500/500 tier caps. |
| `BILLING_REQUIRED` | keep `true` | |

Redeploy the web service after setting (env is read at process start; `NEXT_PUBLIC_*` is baked at build). **NEVER-AUTO.**

### Step 4 (d) — Live key swap (web service) — **NEVER-AUTO / operator-executed**
1. `STRIPE_SECRET_KEY` `sk_test_` → `sk_live_`; `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` `pk_test_` → `pk_live_`.
2. `STRIPE_BUILDER_PRICE_ID` / `STRIPE_TEAM_PRICE_ID` → live $69/$199 IDs; the 4 promo IDs → live `promo_…` IDs.
3. Create a **new live webhook endpoint** at `https://fixflags.com/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET` to the live `whsec_`. **Enable event types**: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`. Entitlement is set by the subscription events, not by `checkout.session.completed` alone.
4. Rotate any keys that were pasted into chat during development.
5. Redeploy. **NEVER-AUTO.**

### Step 5 (e) — Live verification sequence (operator) — **NEVER-AUTO / operator-executed**
1. `curl -sS https://fixflags.com/api/health` → `status: ok`, `billingConfigured: true`, `aiConfigured: true`.
2. **Waitlist join as a batch-1 member** → Pro checkout shows **auto-applied 25% off (T1PRO25)** with no customer-enterable promo field → complete a test payment (card `4242 4242 4242 4242`) → **entitlement granted** (plan/status set by the subscription webhook; confirm on the billing page) → waitlist row shows `converted_at` in admin.
3. **Batch-2 member (no grant)** → checkout → **403 `BATCH_ACCESS_REQUIRED`** (with `WAITLIST_OPEN_BATCH=1`).
4. **Non-member** → passes (200/409; legacy behavior, NOT 403 — see ASK-CAPTAIN #6). If the Captain wants non-members blocked, that is a code change, not a flip step.
5. **Master switch off** (`STRIPE_PAID_OPEN=false`) → checkout → **403 `PAID_CHECKOUT_CLOSED`**; Pro/Studio CTAs route to waitlist join.
6. One real smoke charge at list price after the swap (refund if desired); verify tier discount in test mode first.
7. Optional: run `e2e/billing-gate.spec.ts` against a test-mode app (see the spec header; BLOCKED in this session — no test-mode app/env).

### Step 6 — Post-flip
- Confirm `billingConfigured: true` with live keys; re-run section d pre-flip smoke checks against live.

---

## Code review — batch-gate path (verified read-only at HEAD `35cb36a8`)

**COMPLETE (end-to-end, unit-tested):**
- **Waitlist join assigns tier + batch by position** (`lib/billing/waitlist.ts` `claimOrCreateEntry`): per-plan Postgres advisory lock → position = count+1 → `discountTierForPosition` (1–500 tier 1, 501–1000 tier 2, else null) + `batchForPosition` (same caps; `WAITLIST_BATCH_SIZE` default 500). Re-joins update source/campaign/email only — the tier/batch snapshot never changes. Invite redeem overrides batch and stamps `accessGrantedAt`; attach-on-signup carries lead grants onto the real entry (`claimWaitlistLead`).
- **Checkout gate** (`app/api/stripe/checkout/route.ts`): rate limit → auth → plan validity → `isPaidOpenServer()` master switch (403 `PAID_CHECKOUT_CLOSED`) → `hasPlanAccessGranted` (batch released OR explicit `accessGrantedAt` OR `WAITLIST_OPEN_BATCH ≥ 2` general release) else **403 `BATCH_ACCESS_REQUIRED`**. Users with no waitlist row pass (legacy — ASK-CAPTAIN #6). Existing subscribers with access get the 409 billing-portal redirect (checked after the gate).
- **Tier promotion auto-applies, never customer-entered** (`lib/billing/discount-tiers.ts`): `tierCheckoutDiscounts` requires paid open + discount window active (`PLAN_RELEASE_DATE` set, now within [release, +12mo)) + tier on the entry + promo env set → `discounts: [{ promotion_code }]` on the Checkout Session. `allow_promotion_codes` is never set, so no promo field is shown and the 500/500 caps cannot be burned manually.
- **Webhook sets paid entitlement** (`app/api/webhooks/stripe/route.ts`): `customer.subscription.created/updated/deleted` → `processSubscription` (sets plan, `subscriptionStatus`, `stripeSubscriptionId`, price, period end, plan limits) + `markWaitlistConverted`; `checkout.session.completed` attaches `stripeCustomerId`; idempotent via `processedStripeEvent` with payload-hash replay detection.
- **Admin invite / explicit grant path** (`app/api/admin/waitlist/[id]/invite/route.ts`, `requireAdmin`-guarded): actions `invite` (one-time code + email), `grant` (per-member or batch-wide `grantBatchAccess`), `assign_batch`. Export route exists (`/api/admin/waitlist/export`, CSV — note: intentionally omits entry ids).
- **Tests**: `app/api/stripe/__tests__/checkout-batch-gate.test.ts` (5 cases: unreleased batch 403, invite passthrough, released batch, master-switch authority, no-row legacy) and `lib/billing/__tests__/waitlist-batch.test.ts` (position math, eligibility matrix, snapshot, invites, grants, lead claim) — **26/26 green** (run this session).

**MISSING / GAPS (none blocking; flag for Captain awareness):**
- **Discount window before release date**: `tierCheckoutDiscounts` returns null until `PLAN_RELEASE_DATE` — released members pay list price before that date. Runbook Step 3/5 handle it (release date ≤ launch day; past date for earlier test verification).
- **Tier vs batch caps are independent**: tier caps fixed at 500/500 (code constant); `WAITLIST_BATCH_SIZE` changes access cohorts only. Changing tier caps is a code change, not env.
- **Non-member pass-through** (ASK-CAPTAIN #6): intentional legacy, but differs from the O-2 smoke doc and the flip task text.
- Minor: the 409 portal redirect runs after the batch gate, so a (hypothetically) unreleased-batch member with an active subscription gets 403 before the portal path — practically unreachable (subscriptions only start through the gate) and cosmetic.

---

## a) Verified production environment

Web service `QewOS` (all launch vars live here — billing env is read only by web routes + `lib/billing`, never by the worker).

| Variable | Status | Note |
|---|---|---|
| `PAGESPEED_API_KEY` | SET | 39 chars, PageSpeed format |
| `OPENAI_API_KEY` | SET | `sk-proj-` prefix |
| `ANTHROPIC_API_KEY` | **UNSET** | fallback only; see ASK-CAPTAIN #4 |
| `RESEND_API_KEY` | SET | `re_` prefix |
| `RESEND_FROM_EMAIL` | SET | `FixFlags <hello@fixflags.com>` (docs show `hello@saadbenryane.com` — docs stale, prod is fine) |
| `ADMIN_NOTIFICATION_EMAIL` | SET | personal email |
| `R2_BUCKET_NAME` / `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_PUBLIC_URL` | SET (all 5) | `R2_PUBLIC_URL=https://fixflags.com` |
| `DATABASE_URL` | SET | `postgresql://` (len 93) |
| `REDIS_URL` | SET | `redis://` (len 35) |
| `STRIPE_SECRET_KEY` | SET | **`sk_test_`** prefix — switch to `sk_live_` at flip |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | SET | `pk_test_` prefix — switch to `pk_live_` at flip |
| `STRIPE_WEBHOOK_SECRET` | SET | `whsec_` (test) — replace with live at flip |
| `STRIPE_BUILDER_PRICE_ID` | SET | Test price does not match [canonical shipped pricing](../knowledge/strategy.md) |
| `STRIPE_TEAM_PRICE_ID` | SET | Test price does not match [canonical shipped pricing](../knowledge/strategy.md) |
| `STRIPE_CREDIT_PACK_10/25/50_ID` | SET | Test prices active; outside the launch path |
| `STRIPE_EXPERT_REVIEW_PRICE_ID` | SET | Test price active; outside the launch path |
| `STRIPE_API_VERSION` | SET | `2025-02-24.acacia` |
| `BILLING_REQUIRED` | SET | `true` (web only) |
| `STRIPE_PAID_OPEN` | **UNSET** | defaults false → waitlist-only (correct pre-launch) |
| `NEXT_PUBLIC_PAID_OPEN` | **UNSET** | defaults false — must mirror server at flip |
| `WAITLIST_OPEN_BATCH` | **UNSET** | **defaults to 0 → no cohort can check out even after flip** |
| `WAITLIST_BATCH_SIZE` | **UNSET** | defaults to 500 (fine, only if cohorts should differ) |
| `PLAN_RELEASE_DATE` | **UNSET** | no discount window until set |
| `STRIPE_TIER1_PRO_PROMOTION_ID` | **UNSET** | coupon not created yet |
| `STRIPE_TIER1_STUDIO_PROMOTION_ID` | **UNSET** | coupon not created yet |
| `STRIPE_TIER2_PRO_PROMOTION_ID` | **UNSET** | coupon not created yet |
| `STRIPE_TIER2_STUDIO_PROMOTION_ID` | **UNSET** | coupon not created yet |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | SET | URL = `https://fixflags.com`; secret 64 hex |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | SET (all 4) | OAuth SSO |
| `CRON_SECRET` / `TOKEN_ENCRYPTION_KEY` | SET | secret 64 hex; encryption key 64 hex |
| `NEXT_PUBLIC_GA_ID` | SET | `G-5GEP9X4ZWG` |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` / `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL` | UNSET | optional marketing |
| `NEXT_PUBLIC_META_PIXEL_ID` / `META_CAPI_TOKEN` | UNSET | optional marketing |
| `RAILWAY_WEBHOOK_SECRET` | UNSET | optional post-deploy webhook |
| `GSC_SERVICE_ACCOUNT_KEY` | UNSET | optional (set on worker instead) |

Worker service `FixFlags Worker` (audit execution only): `OPENAI_API_KEY`, `PAGESPEED_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, R2 set (all 5), `DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_APP_URL`, `TOKEN_ENCRYPTION_KEY`, OAuth (4), `CRON_SECRET`, `FIXFLAGS_PROCESS_ROLE=worker`, `AUDIT_WORKER_CONCURRENCY`, `GA4_PROPERTY_ID`, `GSC_CLIENT_ID/SECRET`, `GSC_PROPERTY`, `GSC_SERVICE_ACCOUNT_KEY` (len 1 — suspicious). **No Stripe / waitlist / paid-open vars and none needed** — verified no worker code path reads billing env. `ADMIN_NOTIFICATION_EMAIL` UNSET on worker (web has it).

### Live `/api/health` (2026-08-07, commit `451c52f`)

```json
{"status":"ok","database":"ok","commit":"451c52f","pipelineVersion":"2.4.0",
 "storageConfigured":true,"billingConfigured":true,"aiConfigured":true,
 "aiProviderChain":["openai","anthropic"],"aiConfiguredProviders":["openai"],
 "productWatch":{"available":true,"error":null},"emailConfigured":true,
 "workerConfigured":true,"rateLimit":{"redisDown":false,"redisDownSince":null,"lastError":null}}
```

No pageSpeed field is exposed by `/api/health` (PageSpeed is set in env; field absent from the endpoint).

---

## b) Launch-flip checklist (order matters)

Stripe Dashboard steps are manual (no CLI/script). Test first, mirror in live. **Never mix test prices with live keys** (mode = key prefix only).

1. **Prices:** create new **test** and **live** `price` objects on the FixFlags Stripe account:
   - Pro **$69/mo** (recurring monthly) → `STRIPE_BUILDER_PRICE_ID`
   - Studio **$199/mo** (recurring monthly) → `STRIPE_TEAM_PRICE_ID`
   - Replace the current $29/$99 test IDs. Credit packs ($15/$30/$50) and expert review ($500) stay.
2. **Promotion codes** (test first, mirror live; per docs/stripe-setup.md table): internal coupon names `tier1_pro_25_12m`, `tier1_studio_25_12m`, `tier2_pro_15_12m`, `tier2_studio_15_12m`; codes `T1PRO25`, `T1STUDIO25`, `T2PRO15`, `T2STUDIO15`; each **25%/15% off, repeating 12 months, `max_redemptions` 500, `redeem_by` = PLAN_RELEASE_DATE + 12 months**. Codes are not customer-enterable (checkout never enables `allow_promotion_codes`) — the 500 caps can't be burned manually.
3. **Env (web service), then redeploy:**
   - `PLAN_RELEASE_DATE=2026-09-01` (decide + confirm; unset/invalid = no discount window, no promotion applied)
   - `STRIPE_TIER1_PRO_PROMOTION_ID` / `STRIPE_TIER1_STUDIO_PROMOTION_ID` / `STRIPE_TIER2_PRO_PROMOTION_ID` / `STRIPE_TIER2_STUDIO_PROMOTION_ID` = the new `promo_…` ids
   - `WAITLIST_OPEN_BATCH=1` — **trap: unset defaults to 0, and batch 0 releases no cohort, so nobody can check out even with the master switch on** (verified in `lib/billing/paid-open.ts` `openBatch()`). Leave `WAITLIST_BATCH_SIZE` unset (default 500) unless cohorts should differ.
   - `STRIPE_PAID_OPEN=true` **and** `NEXT_PUBLIC_PAID_OPEN=true` — master switch; the client mirror must match or UI stays gated. The master switch is never bypassed by a batch value.
   - Keep `BILLING_REQUIRED=true`.
4. **Live key swap (web service):** `sk_test_` → `sk_live_`, `pk_test_` → `pk_live_`, all price IDs → live, all promo IDs → live, `STRIPE_WEBHOOK_SECRET` → live `whsec_` from a **new live endpoint** at `https://fixflags.com/api/webhooks/stripe`.
5. **Before going live:** rotate any keys that were pasted into chat during development (docs/stripe-setup.md Live flip step 4).
6. **One real smoke charge** at list price after the swap (refund if desired); verify tier discount in test mode first.

Post-change deploy + verify: `curl -sS https://fixflags.com/api/health | jq '{billingConfigured, status}'` → expect `billingConfigured: true`.

---

## c) Env additions still needed (all on web service unless noted)

| Variable | Action |
|---|---|
| `STRIPE_BUILDER_PRICE_ID` / `STRIPE_TEAM_PRICE_ID` | Replace values with new $69/$199 price IDs (test + live) — currently $29/$99 |
| `STRIPE_TIER1_PRO_PROMOTION_ID` | Set after creating `T1PRO25` coupon |
| `STRIPE_TIER1_STUDIO_PROMOTION_ID` | Set after creating `T1STUDIO25` coupon |
| `STRIPE_TIER2_PRO_PROMOTION_ID` | Set after creating `T2PRO15` coupon |
| `STRIPE_TIER2_STUDIO_PROMOTION_ID` | Set after creating `T2STUDIO15` coupon |
| `PLAN_RELEASE_DATE` | Set `2026-09-01` (or decided date) |
| `WAITLIST_OPEN_BATCH` | Set `1` at flip (0 default blocks all checkout) |
| `STRIPE_PAID_OPEN` | Set `true` at flip |
| `NEXT_PUBLIC_PAID_OPEN` | Set `true` at flip (client mirror) |
| `WAITLIST_BATCH_SIZE` | Optional — default 500 is correct for the launch plan |
| `ANTHROPIC_API_KEY` | Optional but recommended (fallback judge provider is configured in chain but inert) |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` / `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL` | Optional marketing — UNSET |
| `NEXT_PUBLIC_META_PIXEL_ID` / `META_CAPI_TOKEN` | Optional marketing — UNSET |
| `RAILWAY_WEBHOOK_SECRET` | Optional post-deploy Launch Check webhook — UNSET |
| Worker `GSC_SERVICE_ACCOUNT_KEY` | Re-check — SET with length 1 (likely wrong); GSC reporting only, not launch-critical |
| Worker `ADMIN_NOTIFICATION_EMAIL` | Optional if worker should emit admin alerts (web has it) |

---

## d) Pre-flip smoke procedure (5 steps, test mode)

1. **Health:** `curl -sS https://fixflags.com/api/health` → `status: ok`, `database: ok`, `billingConfigured: true`, `aiConfigured: true`, `rateLimit.redisDown: false`.
2. **Waitlist join → batch-1 member:** as a test user, join the waitlist for Pro (POST `/api/stripe/waitlist`); confirm the row gets position ≤ 500 → **tier 1 + batch 1** (verified logic: `lib/billing/waitlist.ts` `batchForPosition`, `discountTierForPosition`; join is atomic under a Postgres advisory lock per plan).
3. **Checkout auto-discount:** Pro checkout with test card `4242 4242 4242 4242`; confirm `T1PRO25` auto-applies (25% off) for the tier-1 member and no `allow_promotion_codes` UI is shown.
4. **Non-member:** a user who is **not** on the waitlist passes the batch gate when the master switch is on (legacy global-open behavior, verified in `lib/billing/waitlist.ts` `isCheckoutEligible(null) === true`) → they reach Stripe checkout at list price. They do **not** get 403 — this differs from the earlier draft of this checklist and from the flip-task text; see ASK-CAPTAIN #6 if non-members must be blocked.
5. **Master-switch-off redirect:** set `STRIPE_PAID_OPEN=false` (or before flipping it on) → Pro/Studio CTAs route to **waitlist join** instead of Stripe checkout (`isPaidCheckoutGatedClient()` / server gate).

Then repeat step 1 after the flip and confirm `billingConfigured: true` with live keys.

---

## Caveats

- The table display of `railway variables` **truncates long values** — statuses in section a come from `railway variables --kv` (raw), lengths/prefixes only; no values recorded.
- New checkout uses newly created $29 Pro and $79 Studio prices. Existing active subscribers keep their current Stripe price and allowance until they change or cancel.
- `RESEND_FROM_EMAIL` docs example (`hello@saadbenryane.com`) is stale; prod uses `hello@fixflags.com` — fine for a verified sender.
- Webhook route verified live (unsigned POST → 400). Test-mode webhook events were not replayed in this audit; confirm the test event flow before flip.
- This checklist is read-only verification; the flip itself (Stripe Dashboard, `railway variables set`, redeploy) is not performed.
- **e2e/billing-gate.spec.ts** (new, this session): test-mode batch-gate assertions (waitlist join → checkout gate → admin grant → promo auto-apply, Stripe-verified). Typecheck + lint clean; all 6 tests enumerate. **BLOCKED in this session** — running it needs a test-mode app (`STRIPE_PAID_OPEN=true`, `WAITLIST_OPEN_BATCH=1`, `PLAN_RELEASE_DATE` set, promo envs, test keys) plus fixture users/entry ids and `E2E_BILLING_GATE=true`; exact env list + run steps are in the spec header. It self-skips without `E2E_BILLING_GATE=true`, so the standard `test:e2e` suites are unaffected.
- **Pre-existing e2e runner version clash (workspace-wide, not caused by the spec):** `npm run test:e2e` currently fails for EVERY spec (incl. pre-existing `public-journeys.spec.ts`, `credentialed-journeys.spec.ts`) with "did not expect test.describe()/test.use() to be called here" — `package.json` pins `playwright@^1.62.0` (bin `node_modules/.bin/playwright` → 1.62.0) while `@playwright/test@^1.61.1` (config + specs import this). Fix (operator): align versions — `npm i -D @playwright/test@1.62.0` or `npm i -D playwright@1.61.1` — then re-verify. Out of scope for this task; do not bundle with the flip.
- `STRIPE_TIER*_PROMOTION_ID` values must be **promotion-code ids (`promo_…`)**, not coupon ids — checkout passes them to `discounts[].promotion_code` (verified in code).
