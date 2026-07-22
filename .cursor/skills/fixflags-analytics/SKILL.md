---
name: fixflags-analytics
description: FixFlags launch funnel analytics — event registry, required call sites, admin funnel page, scan duration measurement, and P2 gates. Use when adding trackEvent calls, debugging funnel holes, or updating admin analytics.
---

# FixFlags Analytics / Funnel

**Read [`AGENTS.md`](../../AGENTS.md) first.** Canonical event types live in [`lib/analytics/events.ts`](../../lib/analytics/events.ts).

## North-star

% of completed scans where the user copies a fix and later re-checks.

P2 growth work (audience landers, authentic testimonials, monitoring UI) is gated on ~100 completed scans. See [`.agents/handoffs/launch-funnel-p2.md`](../../.agents/handoffs/launch-funnel-p2.md).

## Event registry (must have call sites)

| Event | Expected call site |
|-------|-------------------|
| `landing_view` | `LandingViewTracker` |
| `audit_intent` | `AuditInput` focus on hero/final |
| `started_audit` | `AuditInput` submit |
| `scan_validation_failed` | `AuditInput` validation |
| `viewed_sample` / `clicked_sample_cta` | `SampleFunnelEvents` |
| `signup_started` | Sign-up email focus **and** `OAuthButtons` click |
| `signed_up` / `signed_in` | Auth pages / `post-login` |
| `audit_completed` / `viewed_report` / `first_finding_viewed` | Report clients |
| `fix_prompt_copied` | `PromptCopyButton` / `ExportMenu` |
| `recheck_started` | `ReportRecheckButton` / detailed `AuditPageActions` |
| `recheck_completed` | Compare page **and** report with `recheckDiff` |
| `report_signup_cta_clicked` | `ReportSignupCta` (`from`: `value_strip` \| `sample_fix` \| `limit_gate`), `AuditLimitGate` |
| `audits_claimed` | `ClaimAnonymousAudits` after successful claim |
| `product_contract_saved` | `ProductContractCard` after successful PATCH |
| `remember_shown` | `ProductMemoryStrip` when verified learnings render |

**Anon funnel stages (GA4):** `started_audit` (`is_logged_in: false`) → `viewed_report` → `report_signup_cta_clicked` → `signed_up` → `audits_claimed` → `fix_prompt_copied` → `recheck_*`.

Measure focused and detailed report visits separately when adding a route-view event. The north-star remains copied fix followed by re-check, not time spent in the explorer. Report order is canonical in `knowledge/report-contract.md`.

Before shipping funnel changes: every `FunnelEvent` union member must have a `trackEvent('…')` call site (or be removed from the union).

## Admin

[`app/admin/analytics/page.tsx`](../../app/admin/analytics/page.tsx) documents the funnel for operators. Includes **Anonymous wedge (last 30 days)** counts and link to `/admin/leads`. Keep descriptions in sync with real semantics.

## Scan duration claims

```bash
npx tsx scripts/measure-scan-duration.ts
```

Do **not** put “Usually ready in X–Y minutes” on the hero until median/p90 are reviewed.

## Completeness check

```bash
rg "trackEvent\('" --glob '*.{ts,tsx}' -g '!node_modules'
rg "type FunnelEvent" -A 30 lib/analytics/events.ts
```
