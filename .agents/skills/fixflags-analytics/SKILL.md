---
name: fixflags-analytics
description: FixFlags launch funnel analytics — event registry, required call sites, admin funnel page, scan duration measurement, and P2 gates. Use when adding trackEvent calls, debugging funnel holes, or updating admin analytics.
---

# FixFlags Analytics / Funnel

Read `AGENTS.md` first. Canonical event types live in `lib/analytics/events.ts`.

## North-star

Verified meaningful improvements per active Product.
The durable customer-value funnel is Recommended → Accepted → Attempted → Verified → Outcome.
Feedback supports judgment analysis but is not proof of value.

Growth thresholds and deferred work live in `ROADMAP.md` and the launch funnel handoff (`.agents/handoffs/launch-funnel-p2.md`); do not duplicate them here.

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
| `audits_claimed` | `useMe.claimAnonymous` after successful claim |
| `audit_limit_reached` | `ContextualUpgradeCard` when free limit gate shows |
| `report_upgrade_gate_viewed` | `ContextualUpgradeCard` on report upgrade moments |
| `report_progress_viewed` / `sticky_nav_used` / `polish_pass_copied` / `flag_detail_viewed` | Report workspace instrumentation |
| `product_contract_saved` | `ProductContractCard` after successful PATCH |
| `remember_shown` | `ProductMemoryStrip` when verified learnings render |
| `help_article_feedback` | `HelpArticleFeedback` on help articles (helpful / not helpful) |
| `help_search_no_results` | `KnowledgeSearch` when a query returns zero hits (deduped per query+filter) |
| `help_search_result_clicked` | `KnowledgeSearch` when the user clicks a search result |
| `marketing_page_view` | `MarketingPageViewTracker` on `/help`, `/faq`, `/docs/*`, pricing, samples, etc. |

**GA4 key events:** Run `npm run growth:configure-ga4-key-events` (requires `GA4_PROPERTY_ID` + service account with `analytics.edit`). Canonical names: `lib/growth/ga-key-events.ts`.

**Client bootstrap:** `app/layout.tsx` installs a `beforeInteractive` gtag stub; `trackEvent` queues to `dataLayer` so early funnel events are not dropped before gtag.js loads.

**Anon funnel stages (GA4):** `started_audit` (`is_logged_in: false`) → `viewed_report` → `report_signup_cta_clicked` → `signed_up` → `audits_claimed` → `fix_prompt_copied` → `recheck_*`.

Measure focused and detailed report visits separately when adding a route-view event.
Client events describe acquisition and interaction; Product, Improvement, Attempt, verification, and outcome records are the funnel source of truth.
Report order is canonical in `knowledge/report-contract.md`.

Before shipping funnel changes: every `FunnelEvent` union member must have a `trackEvent('…')` call site (or be removed from the union).

## Admin

`app/admin/analytics/page.tsx` documents the funnel for operators. Keep descriptions in sync with real semantics.

- Acquisition and visit attribution come from GA4-backed `GrowthArtifact` records.
- Subscription activation, expansion, cancellation, payment failure, and churn come from `SubscriptionLifecycleEvent`, never `User.updatedAt`.
- Keep event-derived revenue cohorts separate from acquisition totals. Do not label independently sourced totals as a conversion funnel.
- Scheduler jobs persist their canonical results. Writing documentation exports is an explicit developer command only.

## Scan duration claims

```bash
npx tsx scripts/measure-scan-duration.ts
```

Do **not** put "Usually ready in X–Y minutes" on the hero until median/p90 are reviewed.

## Completeness check

```bash
rg "trackEvent\('" --glob '*.{ts,tsx}' -g '!node_modules'
rg "type FunnelEvent" -A 30 lib/analytics/events.ts
npm run agent -- eval growth
```
