# Launch checklist (paid plans flip)

**Verified:** 2026-08-07 (UTC) · repo commit `451c52f` · live site `https://fixflags.com` (Railway project `FixFlags` / production / service `QewOS`; worker service `FixFlags Worker`).
**Method:** read-only `railway variables` (table + `--kv` raw), Stripe API price lookups (test key, GET only), `/api/health`, webhook route probe, and code inspection (`lib/billing/paid-open.ts`, `lib/billing/waitlist.ts`, `lib/billing/discount-tiers.ts`, `lib/billing/config.ts`). No secrets recorded; no changes made.

## ASK-CAPTAIN (blocking before flip)

1. **Price IDs point at the wrong amounts.** Verified via Stripe API (test mode, both active): `STRIPE_BUILDER_PRICE_ID` → **$29/mo** (docs claim $39 — docs stale), `STRIPE_TEAM_PRICE_ID` → **$99/mo** (docs claim $129 — docs stale). Launch targets are **$69 Pro / $199 Studio**. New test AND live prices must be created in the Stripe Dashboard (docs/stripe-setup.md "Target list prices").
2. **No promotion codes exist yet.** All four `STRIPE_TIER*_PROMOTION_ID` vars are UNSET. The 4 coupons/codes (T1PRO25, T1STUDIO25, T2PRO15, T2STUDIO15) must be created in Dashboard (test first, mirror live) before the flip; set the promo IDs in env.
3. **PLAN_RELEASE_DATE must be decided** (proposed 2026-09-01) — unset today means no discount window and no promotion applies at checkout.
4. **Anthropic fallback is not configured** on either service (`ANTHROPIC_API_KEY` UNSET; health: chain `openai,anthropic` but `aiConfiguredProviders: ["openai"]`). Not blocking — OpenAI is primary — but the fallback is inert without it.
5. **Webhook secret is test-mode only** (`whsec_`, test). A new **live** endpoint + live `whsec_` on `https://fixflags.com/api/webhooks/stripe` is required for the flip (route verified live: unsigned POST → HTTP 400).

Not blocking, flagged: worker `GSC_SERVICE_ACCOUNT_KEY` is SET with length 1 (likely misconfigured; GSC/GA4 reporting on worker only — optional, not on the revenue path).

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
| `STRIPE_BUILDER_PRICE_ID` | SET | **$29/mo test price — must become $69** |
| `STRIPE_TEAM_PRICE_ID` | SET | **$99/mo test price — must become $199** |
| `STRIPE_CREDIT_PACK_10/25/50_ID` | SET | $15 / $30 / $50 test prices, active — OK |
| `STRIPE_EXPERT_REVIEW_PRICE_ID` | SET | $500 test price, active (not on launch path) |
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
4. **Non-member 403:** a user who is **not** on the waitlist (or whose batch > `WAITLIST_OPEN_BATCH`) hits checkout → **403 `BATCH_ACCESS_REQUIRED`** even though the master switch is on.
5. **Master-switch-off redirect:** set `STRIPE_PAID_OPEN=false` (or before flipping it on) → Pro/Studio CTAs route to **waitlist join** instead of Stripe checkout (`isPaidCheckoutGatedClient()` / server gate).

Then repeat step 1 after the flip and confirm `billingConfigured: true` with live keys.

---

## Caveats

- The table display of `railway variables` **truncates long values** — statuses in section a come from `railway variables --kv` (raw), lengths/prefixes only; no values recorded.
- docs/stripe-setup.md legacy amounts ($39/$129) are **stale** — the API shows the same price IDs are $29/$99 today. Trust the API amounts in this checklist.
- `RESEND_FROM_EMAIL` docs example (`hello@saadbenryane.com`) is stale; prod uses `hello@fixflags.com` — fine for a verified sender.
- Webhook route verified live (unsigned POST → 400). Test-mode webhook events were not replayed in this audit; confirm the test event flow before flip.
- This checklist is read-only verification; the flip itself (Stripe Dashboard, `railway variables set`, redeploy) is not performed.
