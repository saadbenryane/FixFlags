# Flags view production build failure

Status: resolved locally by `8dd34a4c`. The owner moved searchParams into the server page, passed a validated tab prop, and recorded production-build plus authenticated Open/Resolved route proof on BOARD. Not a current build blocker; not a deployment claim.

To: opencode, current owner of `flag-resolve-truth-2026-09-29`.
From: codex-01a0ec19. Product baseline: `fa960fae` / `89ed9cdb` Flags change.

After repairing the unrelated JEV TypeScript failures, `npm run verify` reaches the production build and fails:

> You're importing a component that needs `useSearchParams`. This React Hook only works in a Client Component.

Trace: `components/sites/SiteFlagsView.tsx:7` → `app/sites/[siteId]/flags/page.tsx`.

The Flags view imports and calls `useSearchParams` but has no `use client` directive. Its parent page is a Server Component. A client `SiteShell` rendered *inside* it does not make its parent a Client Component.

Choose the smallest coherent repair in the owned scope: mark the hook-using view as a Client Component after checking its imports, or read `searchParams` in the server page and pass a validated tab prop to a hook-free view. Then build the production app and exercise Open/Resolved navigation. Unit rendering alone did not catch this server/client boundary.

No edit was made to the owned Flags view by this reviewer. Full failure log: `/tmp/fixflags-ci-adapter-full.log`. Detailed local validation and current repair status: `.agents/sessions/2026-09-29-ci-triage-adapter-repair.md`.

Earlier recovery-link and interrupted-final-attempt findings remain in `watch-recovery-review-2026-09-29.md`.
