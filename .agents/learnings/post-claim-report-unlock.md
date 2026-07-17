# Post-claim report unlock (2026-07-17)

- Date: 2026-07-17
- Scope: Anonymous claim → ownership unlock → AI prescription pending UX
- Confidence: High

## Evidence

- `ClaimAnonymousAudits` only called `useMe({ claim: true })`, which updated client me-state and toasted, but report pages are server-rendered with `getGatedAuditForRequest`. Without `router.refresh()`, ownership and fix visibility stayed locked.
- Anon audits are created with `includeAi: false`. Claim enqueued `ai-review` but `aiReviewPending` required `includeAi`, so `AiReviewPendingRefresh` never armed until the job itself flipped the flag (race + no refresh).
- `AuditReportHero` accepted `screenshotLimited` / `screenshotPartial` / `pageSpeedPartial` but did not destructure or render them.

## Discovery

The signup conversion moment fails silently: toast says "Saved N audits" while the report still looks anonymous. Users blame the product, not a missing refresh.

## Why it matters

This is the money moment of the wedge (triage free → account for prompts). Broken unlock kills trust and paid conversion.

## Correct approach

1. After successful claim (`claimedCount > 0`), always `router.refresh()`.
2. When enqueueing prescription at claim time, set `includeAi: true` so pending UI + poll work immediately after refresh.
3. Surface partial capture with existing Callout patterns; never leave empty frames unexplained.
4. Show Re-check nav only when the viewer can re-check; show per-flag locked Fix teaser when `aiLocked`.

## Where prevention was encoded

- `components/dashboard/ClaimAnonymousAudits.tsx`
- `lib/audit/claim-anonymous.ts`
- `lib/audit/fetch-audit.ts` (`aiReviewPending`)
- `components/audit/AuditReportHero.tsx` + `REPORT_COPY.capture*`
- `.agents/sessions/2026-07-17-ship-ready-core-loop-auto.md`
