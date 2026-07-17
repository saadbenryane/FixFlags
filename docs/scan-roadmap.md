# Scan Roadmap

*Last updated: 2026-07-14*

Phased plan to expand FixFlags scans. Every phase must serve the core loop: **check → fix → re-check → prove**.

Full scan list by rubric: [scan-catalog.md](./scan-catalog.md).

**Policy note:** [offering.md](./offering.md) defers most new features until 100 paying users. Phase 1 was the validated exception — flow scan, slop detection, and preview cards directly strengthen the loop for AI builders shipping public URLs. Phase 1 is shipped.

---

## Pipeline (current)

```mermaid
flowchart TD
  capture[Capturing_screenshots] --> flow[Flow_scan]
  capture --> pagespeed[PageSpeed]
  flow --> checking[Deterministic_checks]
  pagespeed --> checking
  checking --> slop[Slop_scan]
  slop --> judge[AI_judge]
  judge --> report[Report_with_preview_cards]
```

**Version:** `PIPELINE_VERSION` `2.3.0` (`lib/audit/pipeline-config.ts`)

---

## Phase 1 — Complete

**Goal:** Catch embarrassing AI-ship failures before share — dead CTAs, placeholder copy, blank link previews.

| Deliverable | Rubric | Method | Status |
|-------------|--------|--------|--------|
| **Slop scan** | Message | deterministic | Shipped (4 check IDs) |
| **Flow scan MVP** | Experience | agent | Shipped (5 check IDs, re-check verifies flow flags) |
| **Preview cards UI** | Reach | UI | Shipped (Google snippet + social card) |
| **og:image validation** | Reach | deterministic | Shipped (`og-image-broken`) |
| **Flow timeline UI** | Experience | UI | Shipped (step strip + failure states) |
| **Docs** | — | — | scan-catalog.md, this file, cross-links |

### Exit criteria (met)

- [x] Re-check marks flow flags FIXED/REGRESSED via `applyDeterministicVerification` + flow re-run
- [x] Flow click uses stable `data-fixflags-flow-idx` selectors
- [x] Single landing capture (desktop screenshot reused as flow step 0)
- [x] Preview cards use design tokens; broken og:image flagged and shown
- [x] `npm run verify` green

---

## Phase 2 — Complete

| Deliverable | Rubric | Notes |
|-------------|--------|-------|
| Measurement scan | Reach | GA4/GTM/PostHog/Plausible presence (`analytics-missing`) — **Shipped** |
| CTA focus scan | Message | Competing primary CTAs above the fold (`competing-ctas`) — **Shipped** |
| Auth & checkout smoke | Experience | Auth/checkout links resolve, incl. cross-origin Stripe (`auth-page-broken`, `checkout-link-dead`) — **Shipped** |
| Flow scan (message layer) | Message | CTA destination matches headline promise (`flow-cta-message-mismatch`) — **Shipped** |

**Exit criteria:** 3 new scan modules — **met** (measurement, CTA focus, auth & checkout smoke), each verified on re-check.

**Deferred (not shipped):** CTA contrast scan — reliable in-browser contrast needs background/gradient resolution that is error-prone, so it was omitted rather than shipped flaky.

---

## Phase 3

| Deliverable | Rubric | Notes |
|-------------|--------|-------|
| Secret leak scan | Reach | API keys in source/bundles |
| Expanded critical path | Experience / Reach | Cross-page OG consistency |
| Real device mobile | Experience | iPhone Safari + Android Chrome via BrowserStack/LambdaTest |

**Exit criteria:** Real device screenshots in report; 2 device profiles minimum.

---

## Phase 4

| Deliverable | Notes |
|-------------|-------|
| ~~Repo-connected codebase scanning~~ | **Shipped, not roadmap.** GitHub OAuth connect, repo allow-listing, on-demand scan, and a dedicated report at `/report/repo/[id]` are live on Agency plan (`/settings/integrations`). Findings-only today (secrets, dependency hygiene, dangerous patterns) — see `docs/offering.md`. |
| CI deploy gate | GitHub Action / webhook; fail on launch gate regression |
| Weekly pulse | Scheduled re-check; email on REGRESSED flags |
| Auto-fix PRs on repo scans | Open a PR with fixes applied, not just findings — natural next step once repo scanning has usage data |

**Exit criteria:** One CI integration doc; pulse cron job in worker.

---

## Phase 5

| Deliverable | Notes |
|-------------|-------|
| Native app scan | Real device tap-through for mobile apps |
| Store listing scan | App Store / Play Store metadata |

**Exit criteria:** Native app audit mode documented and gated.

---

## References

- Check ID registry: `lib/audit/check-ids.ts`
- Verification rules: `lib/audit/verify-flags.ts`
- Pipeline config: `lib/audit/pipeline-config.ts`
