# Completeness review rules

Use this file for judgment-heavy review. Deterministic drift belongs in `scripts/completeness-audit.mjs`.
Canonical skill body: `.agents/skills/fixflags-completeness/references/drift-rules.md`.

## Product and persistence

- A signed-in hostname resolves to one internal Product by `canonicalHost`. `isManaged` controls Studio quota and UI only.
- All Product Intelligence mutations use the revisioned mutation helper. Contract edits, feedback, claims, heuristics, and verified learning must merge current state.
- Claims keep their cookie until ownership, Product attachment, Contract merge, and audit assignment commit together.
- Manual update reviews stay free. Only Watch children produce scheduled regression delivery. Watch is Studio only.

## Sharing and access

- Canonical reports are public at `/report/[id]`. Copy link is the share action.
- Legacy `/share/[token]` is compatibility-only. Opening a leftover token never changes `Audit.isPublic`.
- Do not reintroduce protected-share create, view-limit, or password UX.

## Report and Finish Plan

- Report hierarchy and order live only in [`knowledge/report-contract.md`](../../../../knowledge/report-contract.md). Review that source instead of copying its sequence here.
- Default `/report/[id]` is Agent beside Report. Preview, Timeline, and Canvas stay parked.
- `buildUnifiedPlanBundle` plus `buildFixList` own ranking and prompts. Do not restore Quick Plan as the default export.
- Anonymous reports show evidence and gated Copy chrome. Never add signup buttons to each Flag.

## Runtime and release

- Missing PostgreSQL, Redis, migrations, required environment, Chromium, worker readiness, or configured email must be visible through doctor/health state.
- Exercise loading, empty, partial, failed, owner, anonymous, shared, watched, and update-review states at 375, 768, and 1280 pixels.
- Verify keyboard focus, dialog/sheet semantics, reduced motion, error recovery, and queue crash recovery.
