# Anonymous stale starter cards

**Status:** Locally implemented and verified. **Owner:** `codex-root`. **Branch:** `main`. **Date:** 2026-10-01.

## Customer outcome

Anonymous visitors can now see that FixFlags checked an area before but its evidence is out of date. FixFlags still hides starter areas it has never checked, so the beginner board stays focused without erasing historical coverage.

## Delivered

- Changed the anonymous empty-card filter to hide only `evidenced: false` cards.
- Kept expired `evidenced: true` cards visible with `Check out of date`, the recovery instruction, source and original checked time.
- Added a rendered regression that distinguishes stale Conversion evidence from never-checked Security.
- Updated the product and design-system skills with the explicit freshness-versus-evidence contract.
- Recorded the distinction as a durable learning so future presentation filters do not infer historical evidence from current state.

## Evidence

- Red before green: the focused rendered test could not find Conversion under the old predicate.
- The focused SiteBoard suite passes 22/22 tests.
- A real anonymous Site backed by the stored `example.net` scan was temporarily aged through the existing eight-day freshness path. At 375×812 it showed stale Conversion, Uptime and Accessibility cards, kept the Search Flag visible, and omitted never-evidenced Security, Tracking and Performance.
- The mobile route had `innerWidth === scrollWidth === 375` and no browser warnings or errors.
- Opening the Conversion card showed `Run a new check for current evidence`, source `FixFlags browser`, and `<time datetime="2026-09-20T17:58:10.414Z">`. The local audit was then restored exactly to `completedAt=2026-09-26T17:58:10.414Z` and `updatedAt=2026-09-26T17:58:10.637Z`.
- Final `npm run agent -- verify`: all 30 selected commands passed, including database validation/drift, nonincremental TypeScript, lint, 5,723 unit tests, coverage, accuracy evaluation, optimized Next build, worker build and container build. Receipt: `.agent-runs/2026-10-01T17-35-09-722Z-container-build.log`.

## Limits

This is local implementation evidence, not a production release or customer validation. Production deployment and existing release gates remain unchanged. Unrelated JEV working-tree changes were preserved.
