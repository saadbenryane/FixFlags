---
name: fixflags-product
description: FixFlags product behavior, entitlements, billing, audit pipeline, and dev workflow. Use when changing auth, audits, re-checks, Stripe, MCP runtime, expert review, admin tools, or anything where marketing copy must match code. Triggers on entitlements, quota, worker, webhook, recheck, share link, API keys, expert review, validateProductionEnv.
---

# FixFlags Product (source of truth for behavior)

Read before changing product logic or writing copy that promises a feature.

## Canonical files

| Area | Files |
|------|-------|
| Scan catalog + roadmap | `docs/scan-catalog.md`, `docs/scan-roadmap.md` |
| Check ID registry | `lib/audit/check-ids.ts` |
| Copy + upgrade strings | `lib/marketing/copy.ts` (`UPGRADE_MOMENTS`, `MCP_DOCS`, `FAQ`) |
| Upgrade moment resolver | `lib/billing/upgrade-moments.ts` (logic only) |
| Plan definitions | `lib/billing/plans.ts` (`getMarketingPlans()`) |
| Entitlements | `lib/auth/entitlements.ts` |
| Scan limits (dev bypass) | `lib/auth/permissions.ts` |
| Audit create/queue | `lib/audit/create-audit.ts`, `worker/index.ts` |
| Re-check | `lib/audit/recheck.ts` |
| Rubric order | `lib/audit/constants.ts` (`RUBRIC_ORDER`) |
| MCP poll helper | `lib/audit/poll-audit.ts` |
| Production env | `lib/env.ts`, `instrumentation.ts` |
| Auth redirect | `middleware.ts`, `lib/auth/redirect-path.ts` |

## Plan display names vs DB enum

Stripe/Prisma still use `BUILDER`, `TEAM`, `STUDIO`. UI labels from `PLAN_DEFINITIONS`:

| Enum | Display name | Share links | MCP API keys |
|------|--------------|-------------|--------------|
| `FREE` | Free | No | No |
| `BUILDER` | **Pro** | No | Yes |
| `TEAM` | **Agency** | Yes | Yes |
| `STUDIO` | Studio | Yes | Yes |

Do not market white-label reports or priority support — not implemented.

## Dev workflow

- `npm run dev` — Next.js only; audits stay **QUEUED** without worker
- `npm run dev:all` — **required** for local audit completion (web + worker)
- `AuditProgress` shows dev warning if `QUEUED` >30s
- `DEV_SIMULATE_BILLING=true` — test plan gates locally (recheck trial, share, API keys)
- `instrumentation.ts` calls `validateProductionEnv()` on Node startup

## Audit quota vs re-check

| Action | Counts toward monthly/lifetime audit limit? |
|--------|---------------------------------------------|
| New URL audit | Yes (unless admin/dev unlimited) |
| Paid re-check | **No** (`skipUsageCount: true` in `recheck.ts`) |
| Free trial re-check (1×) | **No** (`skipUsageCount: true`) |

Copy must say: monthly limits apply to **new URL audits**; paid re-checks are unlimited and free on quota.

## Entitlements (`shouldEnforcePlanGates()`)

When enforcing (prod or `DEV_SIMULATE_BILLING`):

- `canAccessPaidFeatures` — Pro+ report tier, paid re-check
- `canUseFreeRecheck` — FREE + `freeRecheckUsedAt` null
- `canSharePublicly` — **Agency (TEAM) or Studio only**
- `canUseApiKeys` / `canUseMcp` — Pro+

UI must gate before API 402:

- Share button: only if `canSharePublicly || isPublic` (`AuditPageActions`)
- API keys page: `entitlements.canUseMcp` from `/api/me`

## Auth redirects

`middleware.ts` sets `x-pathname`. Layouts use `getRequestedPath()` + `signInUrl()` so sign-in returns to `/billing`, `/settings/api-keys`, `/compare/[id]`, `/admin`, etc.

## Stripe

- Webhooks: `customer.subscription.created/updated/deleted` upgrade/downgrade plan
- Checkout success: `/dashboard?upgraded=1&plan=BUILDER|TEAM|STUDIO`
- `DashboardCheckoutToast` reads plan from URL or `/api/me`
- Expert Review: one-time payment → `expertReviewOrder` → customer email + `/billing` status + `/admin/expert-reviews` fulfill queue

## MCP

- HTTP only at `/api/mcp` with `x-api-key` header — **no** `@fixflags/mcp` npm package
- Docs/config in `MCP_DOCS` in `copy.ts`
- `pollAuditUntilDone()` for `waitForCompletion`; return final status, not stale `QUEUED`
- Route aborts on client disconnect

## Expert Review ($500)

Minimal fulfillment (do not defer):

1. Customer confirmation email on payment (`lib/email/expert-review.ts`)
2. Orders on `/billing` with status (PAID / FULFILLED)
3. Admin queue `/admin/expert-reviews` → mark FULFILLED

## Tests & CI

- `npm run test:unit` — `lib/__tests__/hardening.test.ts`
- `.github/workflows/ci.yml` — tsc, lint, test, build
- `*.db` gitignored; use Postgres via `npm run db:migrate`

## Anti-patterns (product)

- Promising features not in entitlements (share on Pro, unlimited re-check on Free beyond 1× trial)
- Copy-only fix when quota/entitlement design is wrong
- Hardcoded plan prices in marketing — derive from `getMarketingPlans()`
- `npm run dev` without documenting worker requirement
