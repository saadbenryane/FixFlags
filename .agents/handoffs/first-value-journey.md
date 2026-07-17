# First-value journey — working log

- Date: 2026-07-17
- Owner: auto
- Board task: `first-value-journey`
- Status: implemented locally; live browser walk limited (IDE browser MCP unavailable this session)

## Goal

Shortest credible path: paste URL → anonymous triage value → earn signup for fix prompts → copy fix → re-check.

## Journeys tested / evidence

| Journey | Method | Result |
|---------|--------|--------|
| Ideal anon homepage submit | Code path + production FAQ/homepage fetch | **Before:** landing redirected to `/sign-up` before `POST /api/checks`. **After:** landing posts scan like tool pages. |
| Skeptical / sample | Code + live homepage markdown | Sample scroll still no-account; unchanged. |
| Incomplete URL | Client validation in `AuditInput` | Still blocks empty / invalid / localhost before POST. |
| Second anon scan | `checkAnonymousAuditAllowed` + `AuditLimitGate` | Still requires signup; gate now preserves `next=/dashboard?url=...`. |
| Post-signup URL handoff | Dashboard `autoStart` | `/dashboard?url=` auto-submits once (covers leftover signup deep links). |
| Report claim CTA | `AuditReport` | Moved immediately below flags explorer for anon viewers. |
| AI pending | `AiReviewPendingRefresh` | Polls status for `aiReviewAt`, then `router.refresh()`. |
| Queue wait | `setActiveAudit` + progressive Callout | Surfaces `estimatedWaitSeconds` when queued >5s. |
| Analytics core loop | `events.ts` + call sites | `isLoggedIn` returned from API; `recheck_started`; `fix_prompt_copied` params. |

## Decisions

1. Keep two-phase wedge (anon triage → signup for prescription). Do not give anonymous users fix prompts.
2. Restore homepage to the documented free first scan instead of inventing a new funnel.
3. Prefer surgical path fixes over homepage redesign (art-direction task already closed).
4. Avoid banned marketing word "unlock".

## Changes shipped

- [`components/audit/AuditInput.tsx`](../components/audit/AuditInput.tsx) — removed forced signup redirect; stores queue estimate; passes next to limit gate.
- [`components/audit/AuditLimitGate.tsx`](../components/audit/AuditLimitGate.tsx) — signup/sign-in preserve `next`.
- [`app/(app)/dashboard/page.tsx`](../app/(app)/dashboard/page.tsx) — `autoStart` when `?url=` present.
- [`app/api/checks/route.ts`](../app/api/checks/route.ts) — returns `isLoggedIn`.
- [`lib/marketing/copy.ts`](../lib/marketing/copy.ts) — FAQ / FINAL_CTA / UPSELLS / ANON_CLAIM_GUIDE aligned to free-first-scan → account-for-prompts.
- [`components/audit/AuditReport.tsx`](../components/audit/AuditReport.tsx) — claim CTA after flags.
- [`components/audit/AiReviewPendingRefresh.tsx`](../components/audit/AiReviewPendingRefresh.tsx) — new.
- [`components/audit/AuditReportProgressive.tsx`](../components/audit/AuditReportProgressive.tsx) — queue wait Callout.
- [`lib/analytics/events.ts`](../lib/analytics/events.ts) + recheck / copy sites — core-loop measurement.

## Verification

- `npm run typecheck` — pass
- `npm run lint` — pass
- Targeted vitest (`homepage-message`, `usage-limits`, `checks/route`) — pass

## Residual / next highest-leverage

1. Live verify on `fixflags.com` after deploy: anon `example.com` scan → report → signup claim → fix prompt appears without reload.
2. Meta Pixel CSP block and OAuth GA signup tracking still open (deferred; not required for path fix).
3. `ExportMenu` fix-prompt copies still untracked.
4. Confirm autoStart does not surprise returning users who land on `/dashboard?url=` from a bookmark (mitigation: only when query present; one-shot ref).

## Stop condition

Remaining issues are measurement/CSP polish or need production deploy evidence. Core first-value path friction addressed in code.
