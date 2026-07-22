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
| Vision / PI (north star) | `knowledge/vision.md`, `.cursor/skills/fixflags-product-intelligence/SKILL.md` |
| Report hierarchy | `knowledge/report-contract.md` (do not duplicate its route or section order here) |
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
| Task outcomes | `lib/audit/task-contracts.ts` (`checkAndPlan`, `recheckAndCompare`) |
| Re-check | `lib/audit/monitoring.ts` |
| Sample provenance | `lib/marketing/live-sample.ts` (deterministic curated snapshot for marketing rendering) |
| Billing gate | `lib/billing/credits.ts` (`wouldBlockNewCheckWithCredits`) |
| Report explorer | `components/report/ReportExplorer.tsx`, `lib/report/explorer-model.ts` |
| Sample Finish Plan | `components/marketing/landing/HeroProductPreview.tsx`, `/samples`, `/samples/details` |
| Live explorer adapter | `components/audit/LiveReportExplorer.tsx` |
| Rubric bar | `components/audit/RubricBar.tsx` (compact jump links; not a second flag browser) |
| Finish Plan | `lib/audit/finish-plan.ts`, `lib/report/report-view-model.ts`, `FocusedAuditReport.tsx` |
| Full review | `components/audit/AuditReport.tsx`, `/report/[id]/details` |
| Share grants | `lib/security/share-grant.ts`, `/api/share/[token]`, `/share/[token]` |
| Share status | `components/audit/ShareStatusBanner.tsx`, `lib/audit/share-status.ts` |
| Funnel events | `lib/analytics/events.ts`, `.cursor/skills/fixflags-analytics/SKILL.md` |
| Admin funnel | `app/admin/analytics/page.tsx` |
| Visual evidence | `lib/audit/capture/*`, `lib/audit/persist-visual-evidence.ts` |
| Browser capture | Playwright via `lib/audit/browser/page-session.ts`, `lib/audit/screenshot.ts` |
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

Agency **repo Fix PR** is shipped (`lib/repo-scan/create-fix-pr.ts`, finding card UI). Document it as live. White-label share branding is still not implemented.

When shipping user-visible work, add a plain-language entry to `CHANGELOG_ENTRIES` in `lib/marketing/copy.ts` (no internal jargon).

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
| Re-check (owned report) | **No** (`skipUsageCount: true` in `monitoring.ts`) |

Web, MCP, and CLI must share the task outcomes. Do not coordinate create → poll → report → plan or re-check → compare in a transport client.

Canonical boundaries: `/api/checks`, `/api/reports/[id]/*`, `ff_check_and_plan`, and `ff_recheck_and_compare`. Do not add compatibility redirects.

Copy must say: monthly/lifetime limits apply to **new URL checks**; re-checks on owned reports are unlimited and free on quota.

## Anonymous wedge (acquisition)

| Stage | Gets | Does not get |
|-------|------|--------------|
| Anon teaser (exactly 1) | Score, rubrics, three problem/evidence summaries, exactly one complete demonstrated fix | Remaining prompts, ownership, re-check, 2nd new URL |
| After signup + claim | Full fixes, prescription enqueue, ownership, re-check | — |
| Free account | 3 lifetime new URL checks (**claimed teaser counts as 1**) | Unlimited new URLs |

**Enforcement (single path):**
1. `createAndEnqueueAudit` when `userId == null`: `checkAnonymousAuditAllowed` → `AuditLimitError` `AUTH_REQUIRED` / `signup`; `enforceAnonymousIpSoftCeiling(clientId)` when provided; `trackAnonymousAuditId` after create (cookie stores **one** id).
2. Report + `/api/v1/score`: strip deterministic/AI prompts for non-owners (`report-access.ts`, `fetch-audit.ts`). Never return `fix` / `agentPrompt` from score API.
3. `claimAnonymousAudits`: set `userId`, `incrementUsageOnCompleteForAudit` for completed non-recheck audits, enqueue prescription when credits allow.
4. Auth: **`/post-login` only** → `useMe({ claim: true })` → `ClaimAnonymousAudits` + `router.refresh()`.

**Lead capture:** `upsertLeadFromAudit` on finalize; admin `/admin/leads`. No separate email capture on anon report.

**Do not:** client-side unlock (`lib/first-report.ts` removed); duplicate anon gate in routes (checks/roast/score pass `clientId` only).

### Limit actions (single pipeline)

Gate: `wouldBlockNewCheckWithCredits` → `AuditLimitError` (carries `code` + `action` + `message`) → `/api/checks` returns those fields → `AuditLimitGate`.

| `action` | When | UI CTA |
|----------|------|--------|
| `signup` | Anon / auth required | Create account / Sign in |
| `upgrade` | Free (or revoked) at cap | `/pricing` |
| `buy_credits` | Paid at cap, no purchased credits | `/billing#credit-packs` (primary), optional upgrade secondary |

**Never hardcode** `action: 'upgrade'` in the checks route. Pass `err.action` from `AuditLimitError`.

## Report surfaces

Read and follow [`knowledge/report-contract.md`](../../knowledge/report-contract.md). It is the only route and section-order contract. Keep this skill limited to component ownership and product boundaries.

| Surface | Owns | Does not own |
|---------|------|--------------|
| `AuditReportHero` | Hostname, URL, `ScoreDot`, capture callouts; scanning badge + `getScanningLabel` while in progress | Share status, score ring, sticky nav, verdict blockquote |
| `ShareStatusBanner` | Share readiness + per-rubric status badges (completed only) | Flag lists, hero identity |
| `RubricBar` | Compact rubric score proof; `loading` → Scanning | Flag browsing |
| `ReportExplorer` | Working score ring (`sm`), filters, flag list, detail panel, fix prompts, screenshot + visual evidence | Page chrome, share status |
| `ReportStickyToolbar` | Section nav matching DOM (Contract, Priorities, Journey, Flow, Timeline, Flags, …); stuck hostname + `ScoreDot` | Fix prompt editing, Overview |

Do not reintroduce removed nav shells (`ReportMiniNav`, `CompletenessHeader`, `RubricsPanel`, `ReportHeroHeader`, Overview tab).

**Density:** explorer score is always `ScoreRingGauge` `sm` (68px). No dead `lg` size. Filter header uses tight `gap-3` / `pb-3`.

**Progressive / scan UX:**

| File | Role |
|------|------|
| `components/audit/AuditInput.tsx` | Submit → `/report/{id}` |
| `hooks/useAuditPolling.ts` | SWR on `/api/reports/{id}/status` |
| `app/api/reports/[id]/status/route.ts` | Lightweight payload: status, progress, screenshots, rubrics, `partialFlags` (CHECKING+), `actionTimeline`, `productContract`, `shareStatus` |
| `components/audit/AuditPageClient.tsx` | Poll → progressive; on COMPLETED **hold frame** + `router.refresh()` (never blank the payoff) |
| `components/audit/AuditReportProgressive.tsx` | In-progress three-card Finish Plan with captures and collapsible checking detail |
| `lib/audit/progress-ui.ts` | `getProgressPercent`, `getScanningLabel`, `getActivityMessage` (must be wired in UI) |

**Progressive rules:** build toward three Finish Plan cards, show captures and early findings, keep Contract/timeline inside “How FixFlags is checking,” never exceed backend progress, and hold the frame through the completed refresh. Follow the canonical report contract for all ordering.

**Anti-patterns:** fake progress past backend; blank on COMPLETED; Scout chat; second hero; rubrics after flags on progressive; orphaned stage copy helpers unused in UI.

**Progressive parity:** `AuditPageClient` must pass `productContract` and enriched `partialFlags` (`checkId`, `source`) into `AuditReportProgressive`. Hide Action Timeline when empty. Status API selects `checkId` + `source` for truth labels mid-scan.

**`aiEnhancementPending`:** pass `isLoggedIn && aiReviewPending` into the explorer (do not force `false` when prescription is unlocked).

## Product Contract, Finish Plan, truth, and competitive boundary

- **Product Contract / PI** (`lib/audit/product-contract.ts`, `lib/audit/product-intelligence.ts`): inferred purpose, first-value journey, critical outcomes. Project-scoped `productIntelligence` persists across audits; Audit stores a snapshot. Owners edit it in the detailed review. Claim retries until Product attachment succeeds.
- **Finish Plan** (≤3): `buildFinishPlan()` owns Contract-aware ranking and access redaction for every surface. Separate Export “All prompts” remains explicitly outside the Finish Plan contract.
- **Remember:** `ProductMemoryStrip` shows `verifiedLearnings` / notes / risks. Claim must `ensureProductProject`. Contract edit uses `mergeContractIntoProductIntelligence`.
- **Product watch:** Pro/Agency Project `watchInterval`; `lib/audit/project-watch.ts`; regression email only. Free keeps manual re-check.
- **Competitive boundary:** Scout/Signo = direct. CodeRabbit = adjacent code gate (do not partner for GTM; do not sell as PR review).
- **Dismissal:** Intentional → `intentionalNotes`; low_priority → `knownRisks`.
- **Do not build** Scout-style conversational QA chat on the audit path. Depth = Contract + Finish Plan + probes + Flags + re-check + Remember.
- **Roast / badge / CLI** create audits through the same entitlement gate as `/api/checks` (no unlimited anonymous bypass). Roast strings live in `lib/marketing/copy.ts`.
- **Rubrics:** Message / Experience / Reach only. Five integrity dimensions are Integrity Engine framework — see `fixflags-product-intelligence` skill.

## Sample provenance

Marketing pages use a versioned curated snapshot from the completed PlantDad demo audit. They never query production audit rows or silently change proof at render time. Fixture routes remain for offline audit testing.

Eligibility (`isEligibleMarketingSample`): `reportCompleteness === FULL`, at least one flag, rubrics present, desktop screenshot. **Not** score floors. Tests: `lib/marketing/__tests__/sample-provenance.test.ts`.

## Billing gates (new URL checks)

FREE plan: 3 lifetime checks enforced in `create-audit.ts` via `wouldBlockNewCheckWithCredits` (counts pending non-terminal audits). Revoked paid subscriptions downgrade to FREE for hard gates.

Re-checks set `skipUsageCount: true` and bypass this gate entirely.

## parentId validation

When `parentId` is set (re-check/monitoring), `assertParentAuditAllowed` in `create-audit.ts` verifies:

- Parent audit exists and is `COMPLETED`
- Caller owns the parent (or admin)
- Parent is not itself a child re-check chain violation

Finalize diffs child vs parent via `diffFlagsAgainstParent` when `audit.parentId` is set.

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

## Stripe / billing

Canonical setup: [`docs/stripe-setup.md`](../../docs/stripe-setup.md). Config helpers: `lib/billing/config.ts`.

**Required env (all or none when any set; `BILLING_REQUIRED=true` on revenue deploys):**
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BUILDER_PRICE_ID`, `STRIPE_TEAM_PRICE_ID`, `STRIPE_CREDIT_PACK_{10,25,50}_ID`. Optional: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (hosted Checkout; no client SDK). `STRIPE_RESTRICTED_KEY` is operator-only, not read by the app.

**Test vs live:** key prefix only (`sk_test_` / `sk_live_`). Create products with the same secret Railway uses. Never mix accounts.

**Checkout:** hosted Stripe Checkout; `automatic_tax` + `billing_address_collection: 'required'`. Existing active sub → portal (409), never a second subscription.

**Webhooks** (`app/api/webhooks/stripe/route.ts`): `customer.subscription.created|updated|deleted`, `invoice.payment_failed|payment_succeeded` (both re-run `processSubscription`), `checkout.session.completed|expired`, `charge.refunded`. Idempotent via `ProcessedStripeEvent`. `payment_failed` emails admin **and** the user (`lib/billing/notify.ts`).

**Post-checkout:** `DashboardCheckoutToast` polls `/api/me` until plan matches before celebrating. Credit packs: `/billing?credits=1`.

**Quota truth:** Free = 3 lifetime **new URL checks**. At limit = hard block. Re-checks free forever. Credit packs = paid overflow ($15/+10, $30/+25, $50/+50). Monthly only (no annual).

**Anti-patterns:** “unlimited deterministic checks still work”; “upgrade for unlimited”; “subscription-only / no credit packs”; promising share on Pro; wrong-account price IDs.

**Health:** `/api/health.billingConfigured` via `isBillingFullyConfigured()`.

**Tests:** `app/api/webhooks/stripe/__tests__/route.test.ts`, `lib/billing/__tests__/config.test.ts`.

## Support / Help Center

- **Help Center:** `/help` — catalog in `lib/help/catalog.ts`. Chrome strings: `HELP_CENTER`, `SUPPORT_CHAT` in `copy.ts`. SLA: `lib/help/sla.ts`.
- **Chat:** `SupportProvider` in `SiteShell`; open via `openSupportChat({ prefill?, auditId? })`. Admin: `/admin/feedback`.
- **Contextual hrefs:** `lib/help/contextual.ts` — wire every new error/limit/billing surface to an article + ask-support CTA.
- **MCP docs:** canonical `/help/mcp`; `/docs/mcp` shares content, canonical URL points to `/help/mcp`.
- **Do not** market priority/dedicated support. High-volume `CONTACT_PLAN` is email only (“Talk to us”).
- **Do not** ship AI Fin replies until help retrieval exists (`onBeforeAgentReply` stays pass-through).

## MCP

- HTTP only at `/api/mcp` with `x-api-key` header — **no** `@fixflags/mcp` npm package
- Tool count lives in AGENTS.md Project facts only (`lib/mcp/tools.ts` `server.tool()`)
- Docs/config in `MCP_DOCS` in `copy.ts`; full guide UI via `components/help/McpGuideContent.tsx`
- `pollAuditUntilDone()` for `waitForCompletion`; return final status, not stale `QUEUED`
- Route aborts on client disconnect
- `fixflags-cli/` wraps the core loop as `check` (completed report + Finish Plan ≤3) and `recheck` (fresh capture + diff + next plan). `scan` remains an alias.

## Deploy packaging

- Railway: `Dockerfile` via `railway.toml` (not Nixpacks). CI does **not** run `docker build`.
- Pin better-auth / `@better-auth/passkey` / `@better-auth/core` together; hoist `@better-auth/core` as a direct dep (passkey imports `@better-auth/core/*` subpaths).
- App uses Zod 4; LLM tool JSON Schema via `lib/audit/zod-json-schema.ts` (`z.toJSONSchema`), not `zod-to-json-schema`.
- Playwright in Docker: system Chromium + `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (see DEVELOPMENT.md).

## Tests & CI

- `npm run test:unit` — full Vitest suite (`lib/**/*.test.ts`, `app/api/**/__tests__`)
- `.github/workflows/ci.yml` — typecheck, lint, guards, test, build, worker:build (no DB steps, no Docker)
- Local `npm run verify` is stricter (includes `db:validate`, `db:check`, `db:drift`)
- Before push when packaging files change: `docker build -t fixflags:local .`
- Billing route tests: `app/api/checks/__tests__/route.test.ts` (402 paths + 201 success), api-keys, projects
- `*.db` gitignored; use Postgres via `npm run setup`

## Anti-patterns (product)

- Promising features not in entitlements (share on Pro, compare on Free)
- Copy-only fix when quota/entitlement design is wrong
- Hardcoded plan prices in marketing — derive from `getMarketingPlans()`
- Hardcoded test counts or MCP tool counts in docs
