# Day-1 Launch Measurement Plan

## Context

Launch objective: "Game On: launch-complete" is deploy-ready once operator fixtures land.
Day-1 measurement must work with zero surprises — funnel events wired, admin funnel page rendering.
This is a **read-only** verification pass.
Source of truth for event semantics: `lib/analytics/events.ts` (the `FunnelEvent` union + `EventParams`).
Source of truth for the GA4 conversion set: `lib/growth/ga-key-events.ts`.
Admin surface: `app/admin/analytics/page.tsx`.

Two firing mechanisms exist in the codebase:

1. Direct: `trackEvent('event_name', params)` — defined in `lib/analytics/events.ts` and imported from there.
2. One-shot, session-storage deduped: `useOneShotEvent('event_name', auditId, buildPayload, deps)` in `lib/hooks/useOneShotEvent.ts`.
   This hook calls `trackEvent` internally, so a `useOneShotEvent('x', …)` call site counts as WIRED for event `x`.

All grep below used `rg -C 0` (zero context) to avoid the repo `rg` default-context noise that prints stray lines.

## Day-1 watch list (in order)

The launch-critical anonymous funnel (per `fixflags-analytics/SKILL.md`):

`started_audit` → `viewed_report` → `report_signup_cta_clicked` → `signed_up` → `audits_claimed` → `fix_prompt_copied` → `recheck_started` → `recheck_completed`

Every step in that chain is WIRED (see status table), so the core day-1 funnel is sound.

Scan duration:

- Measured by `scripts/measure-scan-duration.ts` (runbook: `npx tsx scripts/measure-scan-duration.ts`).
- Surfac­ed in the admin page as `avgAuditDurationSeconds`, computed from completed audits (`startedAt`/`completedAt`).
- Admin page detail target: under 30s. Do NOT print a hero "X–Y minutes" claim until median/p90 are reviewed.

Activation moment:

- `audits_claimed` (anonymous → account, fires in `hooks/useMe.tsx` after `claimAnonymous`).
- Engagement activation: `fix_prompt_copied` (first fix picked up).
- North-star proxy: completed scan → copy a fix → later re-check.

## Wiring status per event

Legend: `WIRED` = at least one `trackEvent('…')` or `useOneShotEvent('…')` call site exists.
`MISSING` = event appears only in the type union / `EventParams` in `lib/analytics/events.ts` — no call site anywhere in the app.

### Day-1 funnel (all WIRED)

| Event | Status | Call site (file:line) |
|-------|--------|------|
| `started_audit` | WIRED | `lib/audit/start-scan-handoff.ts:92` |
| `viewed_report` | WIRED | `components/analytics/ReportViewedTracker.tsx:20` (via `useOneShotEvent`) |
| `report_signup_cta_clicked` | WIRED | `components/audit/ReportSignupCta.tsx:32`, `:41` |
| `signed_up` | WIRED | `app/(auth)/post-login/page.tsx:37`, `:57`; `components/auth/AuthFlow.tsx:189` |
| `audits_claimed` | WIRED | `hooks/useMe.tsx:131` (after `claimAnonymous`) |
| `fix_prompt_copied` | WIRED | `components/audit/PromptCopyButton.tsx:53`; `lib/hooks/useCopyToClipboard.ts:59` |
| `recheck_started` | WIRED | `components/audit/AuditPageActions.tsx:80` |
| `recheck_completed` | WIRED | `components/audit/RecheckCompletedTracker.tsx:17` |

### Supporting funnel (all WIRED)

| Event | Status | Call site (file:line) |
|-------|--------|------|
| `landing_view` | WIRED | `lib/analytics/events.ts:232` (`trackLandingView`, rendered by `LandingViewTracker.tsx`) |
| `audit_intent` | WIRED | `components/audit/AuditInput.tsx:198` |
| `scan_validation_failed` | WIRED | `components/audit/AuditInput.tsx:64` |
| `clicked_sample_cta` | WIRED | `components/marketing/landing/SampleFunnelEvents.tsx:57`, `:77`; `components/audit/AuditInput.tsx:158` |
| `viewed_sample` | WIRED | `components/marketing/landing/SampleFunnelEvents.tsx:19`, `:28` |
| `signed_in` | WIRED | `app/(auth)/two-factor/page.tsx:41`, `:62`; `components/auth/AuthFlow.tsx:209`, `:236` |
| `signup_started` | WIRED | `components/auth/OAuthButtons.tsx:46`; `components/auth/AuthFlow.tsx:138` |
| `audit_completed` | WIRED | `components/audit/AuditPageClient.tsx:126` |
| `first_finding_viewed` | WIRED | `components/report/ReportExplorer.tsx:186` (via `useOneShotEvent`) |
| `audit_limit_reached` | WIRED | `components/billing/ContextualUpgradeCard.tsx:43` (via `useOneShotEvent`) |
| `report_upgrade_gate_viewed` | WIRED | `components/billing/ContextualUpgradeCard.tsx:50` (via `useOneShotEvent`) |
| `report_progress_viewed` | WIRED | `components/audit/AuditReportProgressive.tsx:253` (via `useOneShotEvent`) |
| `report_prompts_unlocked` | WIRED | `components/report/ReportPromptsUnlockedTracker.tsx:13` (via `useOneShotEvent`) |
| `viewed_pricing` | WIRED | `components/pricing/PricingPageClient.tsx:48` |
| `started_checkout` | WIRED | `components/dashboard/UpgradeButton.tsx:42`; `components/pricing/PricingCTAButton.tsx:50`, `:56` |
| `completed_checkout` | WIRED | `components/dashboard/DashboardCheckoutToast.tsx:35` |
| `sticky_nav_used` | WIRED | `components/audit/ReportStickyToolbar.tsx:169` |
| `polish_pass_copied` | WIRED | `components/audit/PromptCopyButton.tsx:62` |
| `flag_detail_viewed` | WIRED | `components/report/ReportExplorer.tsx:262` |
| `product_contract_saved` | WIRED | `components/audit/ProductContractCard.tsx:71` |
| `remember_shown` | WIRED | `components/audit/ProductMemoryStrip.tsx:33` |
| `managed_subscription` | WIRED | `components/billing/ManageSubscriptionButton.tsx:23` |
| `share_link_created` | WIRED | `components/audit/ShareCompareButton.tsx:45` |
| `marketing_page_view` | WIRED | `lib/analytics/events.ts:247` (`trackMarketingPageView`) |
| `waitlist_joined` | WIRED | `components/marketing/waitlist/WaitlistLanding.tsx:83`, `:119` |
| `plan_picker_viewed` | WIRED | `components/billing/PlanPickerDialog.tsx:76` |
| `plan_picker_picked` | WIRED | `components/billing/PlanPickerDialog.tsx:83` |
| `plan_picker_dismissed` | WIRED | `components/billing/PlanPickerDialog.tsx:87` |

### Un-wired (SKILL.md invariant violated — escalate to Captain)

Per `fixflags-analytics/SKILL.md`: "every `FunnelEvent` union member must have a `trackEvent('…')` call site (or be removed from the union)." These three currently violate that rule. They appear ONLY in the type union and the `EventParams` map inside `lib/analytics/events.ts`; there is no `trackEvent` or `useOneShotEvent` call site for any of them anywhere in the app.

| Event | Status | Only present at |
|-------|--------|------|
| `report_claimed` | MISSING | `lib/analytics/events.ts:36` (union), `:133` (params) |
| `beta_interest_submitted` | MISSING | `lib/analytics/events.ts:43` (union), `:140` (params) |
| `scan_limit_gate_signup_completed` | MISSING | `lib/analytics/events.ts:48` (union), `:145` (params) |

Notes on the three:

- `report_claimed` is the report-viewer auth-gate claim event; `audits_claimed` (the post-login claim) is wired, but `report_claimed` has no shipped call site yet.
- `beta_interest_submitted` is a beta-interest form event; not on the core launch path.
- `scan_limit_gate_signup_completed` is a scan-limit gate completion; the related `audit_limit_reached` IS wired, but the "gate signup completed" counterpart is not.

These three should be removed from the `FunnelEvent` union (and `EventParams`) until a call site ships, or given a real call site before launch.

## Admin funnel page status

- Route file: `app/admin/analytics/page.tsx` — EXISTS, renders, 14872 bytes (stat).
- Protection: `app/admin/layout.tsx` enforces an admin/role gate (`auth.api.getSession` + `isAdminUser(user)`; non-admins redirect to `/`). Not exposed to anonymous users.
- What it renders:
  - DB-backed totals: users, accounts with a check, paid accounts, MRR, new/expansion/churn MRR, churn rate, traffic sources (UTM), anonymous vs signed-in check starts, unlinked leads.
  - Scan duration: `avgAuditDurationSeconds` computed from completed audits with `startedAt`/`completedAt`; target "under 30s".
  - A static "GA4 events tracked" reference list (documentation, not a live query).
  - A link to the GA4 dashboard (`https://analytics.google.com`).
- GA4 backing:
  - Canonical conversion set: `lib/growth/ga-key-events.ts` (7 events: `started_audit`, `signed_up`, `audits_claimed`, `viewed_report`, `fix_prompt_copied`, `recheck_completed`, `completed_checkout`). All seven are WIRED.
  - Rolling GA4 + GSC data is persisted into `GrowthArtifact` (schema: `prisma/schema.prisma:1335`), populated by `lib/growth/ga-pull.ts` and `lib/growth/gsc-pull.ts`.
  - Operator command to mark key events in GA4: `npm run growth:configure-ga4-key-events` (requires `GA4_PROPERTY_ID` + service account with `analytics.edit`).
- Status: RENDERS. It is the operator view, not the live event stream. Real-time event counts come from GA4 real-time / the keyed-event dashboard, not from this page's DB queries.

## Scan-duration measurement

- Runbook: `npx tsx scripts/measure-scan-duration.ts`.
- Admin page surfaces `avgAuditDurationSeconds` (DB-derived from `audit.startedAt` → `audit.completedAt`).
- Do NOT publish a hero "usually ready in X–Y minutes" claim until median/p90 are reviewed via the script.

## Five things to check within the first hour of live traffic

1. **Prod gating + gtag stub.** Confirm `app/layout.tsx` installs the `beforeInteractive` gtag stub and `isGaConfigured()` is true in the launched env, so `trackEvent` actually emits to `window.gtag`. A misconfigured property makes every event a no-op (events.ts short-circuits to no-emit in production when unconfigured). This is the single biggest day-1 silent failure mode.
2. **Anon funnel drop at the signup gate.** In GA4 real-time, confirm the first scans produce `started_audit` → `viewed_report` → `report_signup_cta_clicked` → (`signed_up` → `audits_claimed` for claimers, or nothing for non-claimers). If `report_signup_cta_clicked` fires but `signed_up`/`audits_claimed` do not across several reports, the post-login claim handoff (`useMe.tsx:131`) is the place to look.
3. **Three un-wired events stay flat (by design).** `report_claimed`, `beta_interest_submitted`, `scan_limit_gate_signup_completed` will read zero. Confirm they are zero (not broken) — they have no call sites yet. This guards against mistaking a missing instrumentation line for data loss later.
4. **Scan duration and `audit_completed`.** Confirm the first live scans reach `audit_completed` with `duration_ms` populated and that the admin page's `avgAuditDurationSeconds` lands at/below the 30s target. If early scans time out, check the worker pool before touching funnel code.
5. **Admin funnel page renders in prod.** Open `/admin/analytics` (admin role) and confirm no DB query errors, no `GrowthArtifact` / `subscriptionLifecycleEvent` failures, the GA4 dashboard link resolves, and the static "GA4 events tracked" list matches the wired events above (it will, plus the three missing should be reconciled).
