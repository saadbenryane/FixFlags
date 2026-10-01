# Site health refresh

**Status:** Locally implemented and verified. **Owner:** `codex-root`. **Branch:** `main`. **Date:** 2026-10-01.

## Customer outcome

Stale broad Site evidence now has a direct recovery path. An owner can start a fresh check from the stale card; an anonymous visitor is asked to sign in and returns to the same Site before another check is allowed.

## Delivered

- Added explicit `SITE` scope to the shared tenant-scoped `requestSiteRun` command. It permits a zero-Outcome Site-care run without inventing an Outcome or using the legacy report re-check path.
- Routed the authenticated Site runs endpoint through `WEB` source context and the same durable RunRequest plus physical Audit ledger.
- Kept Site care distinct from targeted Flag verification in idempotency and active-run matching, including the zero-selection case.
- Completed Site-care RunRequests without creating an Outcome assessment, and made failed Site care retry through a fresh shared run.
- Added `Check again` to stale card depth for the Site owner. Anonymous visitors get `Sign in to check again` with the current Site as the `next` path.
- Kept stale evidence visible and actionable when a new check is rate-limited or otherwise cannot start.
- Updated the product/design skills and recorded the execution-scope rule as a durable learning.

## Evidence

- Red before green: rendered UI tests could not find either recovery action, the Site run endpoint rejected an empty selection, and the run command could not express broad Site care.
- Six focused files pass with 72 tests, covering owner success, anonymous claim handoff, start failure, route-to-command integration, persistent Site-care execution, completion without assessment, retry, and collision safety.
- Scoped ESLint, nonincremental TypeScript, skill validation and diff checks pass.
- A real anonymous Site backed by the stored `example.net` scan rendered the stale Conversion detail at 375×812 with `Sign in to check again`, the exact `/sign-in?next=%2Fsites%2Fp_cmuip00ro000cony6ea6cny59` return path, original `<time datetime="2026-09-20T17:58:10.414Z">`, `innerWidth === scrollWidth === 375`, and no browser warnings or errors. The local audit was restored exactly to `completedAt=2026-09-26T17:58:10.414Z` and `updatedAt=2026-09-26T17:58:10.637Z`.
- Final `npm run agent -- verify`: all 30 selected commands passed, including database validation/drift, nonincremental TypeScript, lint, 5,733 unit tests, coverage, accuracy evaluation, optimized Next build, worker build and container build. Receipt: `.agent-runs/2026-10-01T22-15-55-484Z-container-build.log`.

## Limits

The browser proof covers the real anonymous claim handoff; the signed-in owner start is covered by the rendered UI test and authenticated route-to-command integration test, not a credentialed browser session. This is not customer validation or a production canary.
