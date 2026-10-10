---
status: supporting
authority: evidence
reviewed_at: 2026-10-10
supersedes: []
---

# Homepage experience continuation

The founder approved implementation and the homepage slice is implemented locally, without deployment. The brand remains **Your software runs. FixFlags watches.** Approved direction is recorded in [DECISIONS.md](../../DECISIONS.md) and [voice-and-copy.md](../../docs/voice-and-copy.md). The earlier [experience review](../../docs/experience-review.md) is research evidence, not a current implementation specification.

## Delivered

- Four moments: brand and real URL entry; seven-category interactive board; coherent sample Flag recovery; configured monitoring and final URL entry. Large comparison and standalone integration/coverage explanations are removed from this page; useful coverage and connections live in depth.
- Shared BoardCard uses consistent 18px answer typography, wrapping labels, neutral surfaces, visible status and one whole-card interaction. Unknown, partial, stale and unconfigured states never imply a pass. Desktop sample uses four columns with Pages spanning two; tablet uses two and phones one.
- Every category exposes results, scope, freshness and limitations through the existing ResponsiveDepth. Conversion separates the checkout Flag from unconfigured Safe Signup. Flag depth uses matching captures, scoped guidance, selectable clipboard fallback, and explicitly sample recovery.
- Pricing HTTP 404 now has its own controlled local capture, `public/marketing/evidence/pricing-unavailable.png`; the homepage thumbnail is identity, not proof. Checkout uses the existing broken/recovered cart fixtures. Other diagnostic results and schedules are explicitly illustrative. No real customer measurements, history or verification run is fabricated.
- Schedule explains two configured behaviors, their scope, last and next execution, and an unconfigured Signup. Daily example checks do not imply instant detection or recurring diagnostics across all categories. The schedule is identified as the later snapshot after checkout recovery.
- All new customer copy remains in `lib/marketing/copy/care-homepage.ts`. No entitlement, billing, pricing, quota, scheduling or backend execution logic changed. The rejected 60-day grant and numerical limits are not approved policy.

## Validation and evidence

- Isolated production build passed with type and build lint validation. Component/marketing/board suite: 95 files, 510 tests passed; final focused homepage/shared-card suite: 18 tests passed, including three new unknown-state cases. Repository lint, brand, UI drift, image, SEO and route-metadata guards passed.
- Production-rendered Playwright: 12 tests passed at 320, 390, 768, 1086, 1280 and 1440px. No overflow or browser exceptions; verified category/Flag/proof interactions, viewport-height phone depth, keyboard opening/Escape/focus restoration, URL-field focus, reduced motion, slider keyboard operation, and mocked API-to-Site handoff.
- Actual screenshots: `.agents/artifacts/homepage-experience/{desktop,mobile,desktop-board,mobile-board,desktop-depth,mobile-depth,mobile-flag}.png`. Visually inspected desktop, phone and phone depth after refinement. Accessibility report lives alongside them in `accessibility.json`.
- Earlier CTA contrast exception is superseded by the quality sprint below: the founder explicitly authorized accessible foreground treatment while preserving Flag Orange.
- Skills validation, knowledge duplication guard, agent doctor and diff checks pass. Extra development server was stopped after repeated recompilation; final browser proof uses the stable isolated production runtime on port 3115. Existing port 3000 development process was preserved.

## Next

Review the rendered direction, then bring the same coverage and status clarity into the real first-analysis → monitoring activation experience. This homepage proves the presentation and existing submission handoff, not a credentialed live analysis/recovery cycle or production scheduling reliability. Sample content remains illustrative; no new backend capabilities are implied. Commercial validation needs measured costs and customer behavior before any entitlement change.

## Quality sprint and activation finding (before implementation)

Phase A retains the existing composition and complete demonstration. The shared brand foreground now uses existing ink in both themes, with the orange fill and button dimensions unchanged. The small recovery-step numeral also uses ink. Actual rendered contrast is 6.25:1 on #FF5A00 and 6.98:1 on the unchanged hover fill. All 13 production-rendered browser tests pass, including full-page automated A/AA checks in both themes and the existing six-width/depth/evidence/handoff coverage. Updated screenshots were visually inspected; `contrast.json` and `accessibility.json` hold measured evidence. Automated checks do not establish exhaustive accessibility certification. Production build, the 10 affected verification commands, 18 focused homepage/card tests and 67 existing activation/claim/Settings/Flag tests pass. No backend or commercial behavior was changed.

The following was the focused recommendation before approval; the implemented activation update below supersedes its approval gate:

- Today: URL submission opens the same provisional Site; category results remain explorable. Sign-in preserves the destination and post-login claims eligible anonymous audits, migrates their Site evidence, and may unlock AI review within credits. Claim does not enable monitoring. Ownership/Site capacity can refuse claim, and claiming at credit exhaustion does not guarantee AI review.
- Setup is split: Overview can confirm the public page or Add can configure availability/discovered checkout; confirmation leaves the schedule unchanged. Settings independently saves cadence. The Watch save path can accept a schedule without executable Outcomes; the scheduler then reports a confirmation failure. Consequently a saved schedule is not proof that useful execution has occurred.
- Cadence selector offers daily even when Free permits weekly; the API applies weekly with an explanatory notice. Weekly activation schedules the first run a week later, whereas tightening to daily makes it due now. An initial analysis is not an independent result for a newly confirmed Outcome.
- Existing technology can support an inline **Keep watching this page** action: preserve account claim, show the analyzed URL and permitted cadence, confirm public-page availability via `watchPage` (show the actual Site URL selected by that command), save the existing schedule, then request an explicit first verification. Show scope, persisted cadence, next run, and pending/failed/verified execution separately. Treat partial setup as retryable, never active-and-healthy. Preserve other confirmed behaviors; do not enable discovered checkout without selection.
- Proposed first slice is frontend orchestration and presentation, using existing confirmation, Watch, and Verify commands. No automatic monitoring on signup, no cadence/entitlement change. Free's existing weekly cadence is the safe baseline; account cadence data must be authoritative, not guessed from the marketing plan. The current Me view exposes a Watch permission boolean, not an allowed-cadence list. Weekly is an existing safe operational baseline for the first Free-Site slice; preserve Settings for other permitted cadences. An authoritative allowed-cadence read would be a follow-up API dependency, not a reason to guess or alter entitlements.
- Checkout discovery requires actual product/action browser evidence. Safe Signup still requires synthetic data, same-origin reset/cleanup, a successful fixture dry run and authorization. Login/password reset remain outside released coverage. Richer automatic journey discovery and full-capability promotional access remain separate development/commercial decisions.
- Success measure: an owned Site with executable coverage, a persisted schedule, and a completed independent run; later expected runs and meaningful recovery provide lasting-value evidence. Signups and dashboard visits alone are insufficient.

This investigation used actual commands/routes and safe mocked local component interactions; it does not establish a live credentialed customer cycle, alert delivery or production scheduler reliability. The founder subsequently approved activation implementation; current delivery below owns continuation.


## Monitoring activation — implemented locally

The Site overview now offers Turn on monitoring, preserving the full category board and the existing account/claim path. The review shows the exact public page, existing confirmed coverage, server-derived permitted cadence and current email preferences. Add more checks opens the existing library directly; keyboard dismissal returns to its Add control. Free's existing weekly policy and all commercial limits remain unchanged.

A small tenant-scoped coordinator reuses confirmation, SET_WATCH and requestOutcomeRun. It preserves existing names/bindings, schedules and worker leases on repeat activation. Initial requests are durably keyed; failed/interrupted enqueue attempts can retry, and resuming paused monitoring requests fresh evidence. Already running Watch batches covering the page are recognized rather than called failed. Schedule success and first-check failure remain separate. Closing the review does not lose the ability to retry a missing first check.

Customer copy lives in `lib/marketing/copy/monitoring.ts`. The page result is “This page opened when we checked.”, not a claim about the whole website. Header status text uses ink while retaining the orange signal. Missing previews have an honest fallback, including failures before hydration. The overview keeps refreshing through Outcome reconciliation, even when the physical audit has finished. The mobile review keeps a natural content rhythm and respects reduced motion.

Validation: real local URL submission and analysis, fixture authentication, signed anonymous claim, executable public-page coverage, persisted weekly schedule, independent CLEAR assessment, unchanged run count/date on repeat activation, and the real due-Watch processor plus worker. Only the disposable fixture's due date was advanced; no cadence policy changed. Existing accounts and processes were preserved. Fixtures, scheduled records and credentials were cleaned up.

Proof and desktop/mobile captures: `.agents/artifacts/monitoring-activation/`. The explicit local test is `e2e/monitoring-activation.spec.ts`; its opt-in guard rejects non-local app/database targets. Local HTTPS preserved secure claim cookies; test-only non-delivery readiness configuration and notifications OFF avoided external messages. Email delivery is not verified. The default local runtime correctly refuses schedule activation without its email configuration. R2 screenshot serving is not configured locally; raw private capture display remains a release dependency, not fabricated evidence.

Focused tests cover owner isolation, allowed cadence, partial setup, repeat/resume/retry behavior, active Watch reuse, session expiry, refresh failure, keyboard/context and post-audit polling. The production build, affected verification commands and contract/document guards pass. No deployment or commercial changes.

Next: verify configured email delivery and private capture serving before release, then adjudicate the unexpected Flags observed on the public fixture against its rendered evidence. Those Flags were retained, not hidden or declared accurate. Production reliability and customer retention remain unproven by this local execution pass.
