# Site error recovery

Date: 2026-09-29. Owner: codex-01a0ec19. Scope: `site-error-recovery-2026-09-29`.

## Problem

The Site route had no segment error boundary. A rendering error could fall through to a generic app/global error and lose the current Site path. `docs/workspace-interface.md` requires an error state that preserves the Site/history and offers recovery. The September 29 completion plan independently identified this gap.

## Change

`app/sites/[siteId]/error.tsx` uses the existing `RouteErrorPage` and the current route param. It offers Retry, Back to Site, and All Sites. The Site link encodes the param; if the route param is absent, All Sites remains available. Copy is canonical in `lib/marketing/copy/errors.ts`. The boundary has no Site data query, so it can render when the Site's own query failed. It does not claim a failed action left data unchanged.

## Evidence and limits

- Rendered UI test: the Site link retains the provisional Site ID, All Sites remains separate, Retry calls `reset`, and the missing-param path remains usable. Existing generic `RouteErrorPage` test also passes (2 files, 3 tests).
- Scoped ESLint, copy drift, UI drift, knowledge duplication guard and `git diff --check` pass.
- Nonincremental TypeScript completed and failed only in the concurrent Wave 1 Outcome-kind changes: `SiteOutcomeConfirm.tsx` lacks LOGIN/PASSWORD_RESET labels, and `outcomes.ts` passes those new kinds into the current Prisma enum. It reported no Site error-boundary error. This is not a green typecheck receipt.
- `npm run agent -- verify --dry-run` selects 30 checks because a separately owned package research edit is in the shared tree. Production build and real Next error interception remain unverified while Wave 1 browser-journey work is in progress. No production deployment or customer observation is claimed.

Next: once the shared tree settles, run required type/build checks and exercise a controlled error in the actual Site route without exposing customer data. Then release under existing gates.
