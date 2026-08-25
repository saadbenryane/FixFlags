# URL-first completion audit

Date: 2026-08-25

Verdict: **NOT COMPLETE / NOT RELEASE-READY**.

The public boundary and core monthly accounting are substantially implemented, but the current worktree still contradicts the approved product contract in retained report capabilities, legacy subscription handling, health response shape, and release evidence.

## P0: retained web capabilities are no longer reachable from a completed report

- `components/report/ReportWorkspaceSplitShell.tsx:79-85` rewrites `view=timeline`, `view=canvas`, and `view=preview` to `view=report` and renders only Agent and Report tabs.
- `app/report/[id]/CompletedReportView.tsx:73-102` always passes `variant="update"` to the report actions.
- `components/audit/AuditPageActions.tsx:100-130` hides comparison, sharing, and export whenever that variant is used.
- The Canvas API and entitlement are retained and the pricing copy promises Canvas, sharing, comparisons, and Watch on every plan, but there is no completed-report entry point for Canvas, report sharing, proof export, or deep-review Timeline/playback.

Action: restore discoverable, coherent secondary actions for Canvas, sharing, export, comparison, and deep-review playback without restoring parked MCP/repository surfaces. Verify each through the real signed-in Free path.

## P0: the release suite currently proves obsolete behavior and cannot pass the new contract

- `e2e/public-journeys.spec.ts:228-239` still requires `/help/mcp` to redirect to `/docs/integrations` and `/docs/mcp` to render. The proxy now correctly returns 404 for both.
- `e2e/credentialed-journeys.spec.ts:334-342` still requires a revoked subscriber to lose Watch, although Watch is now an all-plan web capability.
- `npm run billing:plans-guard` fails because `scripts/billing-plans-guard.mjs:24-28` still reads removed lifetime Free keys instead of `freeProductReviewsPerMonth` and `freeDeepReviewsPerMonth`.
- Release journeys do not cover the required all-plan capability parity and monthly renewal/concurrent admission/deep-review exhaustion/upgrade/downgrade/cancellation/legacy-allowance matrix.

Action: replace the legacy MCP browser test with signed-out and signed-in 404 assertions for every parked page and well-known file; update revoked-plan expectations to retain web capabilities while reducing usage; fix the plan guard; add executable usage-plan journeys or a release-bound integration suite for the missing billing matrix.

## P1: active legacy subscribers do not retain their existing allowance

- `lib/billing/plans.ts:158-164` maps legacy price IDs only to the current `BUILDER`/`TEAM` enum.
- `lib/billing/usage-period.ts:81-100` then overwrites limits from the new plan definitions on every admission/completion roll.
- Therefore a legacy Pro subscriber is changed from 25 product reviews / 4 deep reviews to 15 / 3, and a legacy Studio subscriber from 80 / 10 to 50 / 10. The webhook test only asserts that the enum remains `TEAM`; it never asserts the grandfathered limits.

Action: derive and persist the allowance cohort from the active Stripe price (or retain stored legacy limits while that exact price remains active), and test both legacy tiers through renewal, plan change, and cancellation.

## P1: `/api/health` does not meet the explicit health contract in all builds

- `app/api/health/route.ts` returns `ok`, but no explicit `healthy` boolean on either success or failure.
- `next.config.ts:4-7` embeds `git rev-parse --short HEAD`; `lib/health/commit-sha.ts` rejects that value because it correctly requires 40 hex characters. A container without Railway's runtime SHA therefore reports `commit: null`.

Action: return `healthy: true|false`, retain `ok` only if compatibility needs it, embed the full local SHA, and make container/release tests assert both the boolean and exact 40-character revision.

## P1: the visibility guard is narrower than its promise

- `scripts/power-tools-visibility-guard.mjs:47-59` scans marketing/layout plus help/docs catalogs, but not dashboard, report, settings, onboarding, sitemap route implementation, structured metadata components, or report actions.
- It checks parked path strings only; it does not reject public MCP/CLI/repository/API-key terminology without a link.
- `PARKED_PUBLIC_PREFIXES` omits `/settings/integrations`, even though the proxy parks it.

Action: drive the guard from one canonical parked-prefix registry, scan every public discovery/action surface, and add forbidden customer terminology/artifact assertions. Keep explicit allowlists for dormant implementation directories and GitHub-as-auth copy.

## P2: one Product-history label still exposes internal terminology

- `components/product/ProductWorkspace.tsx:40-42` renders `Recheck` for `UPDATE_REVIEW` even though the canonical customer term is `Update review`.

Action: derive the label from canonical terminology and add the Product workspace to the terminology guard.

## External release blockers with no evidence in this worktree

- No receipt proves production was queried for active subscriptions before changing price mappings.
- No receipt proves the new $29 and $79 Stripe prices were created and bound to production checkout.
- No local-container, release-environment, deployed-origin, or zero-skip production dogfood receipt exists for this revision.

These are release blockers, not reasons to weaken or skip the checks.

## Evidence run

- `npm run power-tools:visibility-guard` — PASS.
- Focused Vitest: usage period, create audit, monitoring, Watch, source-pure fix list, entitlements, `/api/me`, Canvas authorization, health — **132 tests PASS**.
- `npm run typecheck` — PASS.
- `npm run completeness:audit` — PASS.
- `npm run test:scripts` — **83 tests PASS**.
- `npm run billing:plans-guard` — **FAIL** on stale Free lifetime pricing keys.
- Searches inspected proxy coverage, public discovery sources, customer plan gates, report action wiring, usage transactions, Stripe lifecycle handling, release journey annotations, and customer terminology.

## Confirmed strengths

- Parked source/routes/workers/packages remain in place.
- Proxy-level 404 parking covers the principal page, API, webhook, and well-known prefixes.
- `/api/me` no longer returns MCP, API-key, or repository entitlements.
- URL Finish Plans no longer merge repository Flags.
- Free calendar-month and paid Stripe-period rolling use a transaction-scoped user advisory lock; admission counts pending reviews and completion accounting is idempotent.
- New URL, update review, claimed anonymous completion, and Watch share the product-review pool; deep-review usage remains separate.
- Watch postpones to renewal with a clear exhausted-allowance message.

