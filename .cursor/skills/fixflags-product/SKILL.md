---
name: fixflags-product
description: FixFlags product behavior, entitlements, billing, audit pipeline, and dev workflow. Use when changing auth, audits, re-checks, Stripe, MCP runtime, admin tools, or anything where marketing copy must match code. Triggers on entitlements, quota, worker, webhook, recheck, share link, API keys, validateProductionEnv.
---

# FixFlags Product

**Read [`AGENTS.md`](../../AGENTS.md) first.** Volatile facts (model counts, check IDs, MCP tools, test count) live in AGENTS.md Project facts only. Do not duplicate numbers here.

Read before changing product logic or writing copy that promises a feature.

## Canonical files

| Area | Files |
|------|-------|
| Project facts | `AGENTS.md` (counts, pipeline version, glossary) |
| Page text limits | `lib/audit/page-text-limits.ts` |
| Scan catalog + roadmap | `docs/scan-catalog.md`, `docs/scan-roadmap.md` |
| Check ID registry | `lib/audit/check-ids.ts` |
| Copy + upgrade strings | `lib/marketing/copy.ts` (`UPGRADE_MOMENTS`, `MCP_DOCS`, `FAQ`) |
| Upgrade moment resolver | `lib/billing/upgrade-moments.ts` (logic only) |
| Plan definitions | `lib/billing/plans.ts` (`getMarketingPlans()`) |
| Entitlements | `lib/auth/entitlements.ts` |
| Scan limits (dev bypass) | `lib/auth/permissions.ts` |
| Audit create/queue | `lib/audit/create-audit.ts`, `lib/audit/recover-audit-job.ts`, `worker/index.ts` |
| Audit pipeline | `docs/audit-pipeline.md`, `.cursor/skills/fixflags-audit-pipeline/SKILL.md` |
| Triage / prescription | `lib/audit/runner.ts`, `pipeline/finalize-from-outcome.ts`, `run-ai-review.ts` |
| Re-check | `lib/audit/recheck.ts` |
| Rubric order | `lib/audit/constants.ts` (`RUBRIC_ORDER`) |
| MCP poll helper | `lib/audit/poll-audit.ts` |
| Production env | `lib/env.ts`, `instrumentation.ts` |
| Edge security + auth gate | `proxy.ts`, `middleware.ts`, `lib/auth/redirect-path.ts` |

## Plan display names vs DB enum

Stripe/Prisma use `FREE`, `BUILDER`, `TEAM` only. UI labels from `PLAN_DEFINITIONS`:

| Enum | Display name | Share links | MCP API keys |
|------|--------------|-------------|--------------|
| `FREE` | Free | No | No |
| `BUILDER` | **Pro** | No | Yes |
| `TEAM` | **Agency** | Yes | Yes |

Do not market white-label reports or priority support — not implemented.

## Dev workflow

- `npm run dev` — Next.js **and** inline worker (default via `instrumentation.ts`). Audits complete end-to-end in one command.
- `npm run dev:all` — use when `INLINE_WORKER=false` (separate worker process)
- `AuditReportProgressive` shows dev Callout if `QUEUED` ~30s without worker (only when inline worker disabled)
- Worker heartbeat: `lib/queue/worker.ts` writes every 20s (45s TTL); optional `AUDIT_WORKER_CONCURRENCY` (default 5)
- `DEV_SIMULATE_BILLING=true` — test plan gates locally (share, compare, API keys)
- `instrumentation.ts` calls `validateProductionEnv()` on Node startup

## Audit quota vs re-check

| Action | Counts toward monthly/lifetime audit limit? |
|--------|---------------------------------------------|
| New URL audit | Yes (unless admin/dev unlimited) |
| Re-check (owned report) | **No** (`skipUsageCount: true` in `recheck.ts`) |

Copy must say: monthly limits apply to **new URL checks**; re-checks on owned reports are unlimited and free on quota.

## Audit pipeline (triage vs prescription)

- **Triage** runs inline in every `audit` job (primary page). Sets `triageAt`.
- **Prescription** runs in separate `ai-review` job. Sets `aiReviewAt`. Gated by `includeAi` + credits.
- **`includeAi`** does NOT skip triage — it only controls prescription enqueue.
- Health: `/api/health` (`aiConfigured`), `/api/health/ai`
- Post-deploy smoke: `npm run smoke:triage:prod`
- Full reference: `docs/audit-pipeline.md`

## Entitlements (`shouldEnforcePlanGates()`)

When enforcing (prod or `DEV_SIMULATE_BILLING`):

- `canAccessPaidFeatures` — Pro+ report tier, compare, MCP
- `canAccessRecheck` — any authenticated user (owned reports; API enforces ownership)
- `canSharePublicly` / `canExportSummary` — **Agency (TEAM) only**
- `canUseApiKeys` / `canUseMcp` — Pro+

UI must gate before API 402:

- Share button: only if `canSharePublicly || isPublic` (`AuditPageActions`)
- API keys page: `entitlements.canUseMcp` from `/api/me`

## Auth redirects

`middleware.ts` sets `x-pathname`. Layouts use `getRequestedPath()` + `signInUrl()` so sign-in returns to `/billing`, `/settings/api-keys`, `/compare/[id]`, `/admin`, etc.

## Stripe

- Webhooks: `customer.subscription.created/updated/deleted` upgrade/downgrade plan
- Checkout success: `/dashboard?upgraded=1&plan=BUILDER|TEAM`
- `DashboardCheckoutToast` reads plan from URL or `/api/me`

## MCP

- HTTP only at `/api/mcp` with `x-api-key` header — **no** `@fixflags/mcp` npm package
- 13 tools — see `lib/mcp/tools.ts` and AGENTS.md Project facts
- Docs/config in `MCP_DOCS` in `copy.ts`
- `pollAuditUntilDone()` for `waitForCompletion`; return final status, not stale `QUEUED`
- Route aborts on client disconnect

## Tests & CI

- `npm run test:unit` — full Vitest suite (`lib/**/*.test.ts`, `app/api/**/__tests__`)
- `.github/workflows/ci.yml` — typecheck, lint, guards, test, build, worker:build (no DB steps)
- Local `npm run verify` is stricter (includes `db:validate`, `db:check`, `db:drift`)
- Billing route tests: `app/api/checks/__tests__/route.test.ts`, api-keys, projects
- `*.db` gitignored; use Postgres via `npm run setup`

## Anti-patterns (product)

- Promising features not in entitlements (share on Pro, compare on Free)
- Copy-only fix when quota/entitlement design is wrong
- Hardcoded plan prices in marketing — derive from `getMarketingPlans()`
- Hardcoded test counts or MCP tool counts in docs
