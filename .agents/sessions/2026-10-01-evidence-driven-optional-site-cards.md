# Evidence-driven optional Site cards

**Status:** Locally implemented and fully verified. **Owner:** `codex-root`. **Branch:** `main`. **Date:** 2026-10-01.

## Customer outcome

FixFlags now shows Uptime and Accessibility when it has something trustworthy to say, without cluttering a beginner's Site home with empty optional categories.

## Delivered

- Added an explicit `evidenced` field to the board-card view instead of inferring coverage from presentation state.
- Revealed optional Uptime and Accessibility cards for anonymous and signed-in customers when they have positive evidence or an open Flag.
- Kept untouched optional cards and first-check placeholders hidden.
- Preserved stale optional evidence on the board with its out-of-date state.
- Defined positive Uptime coverage as a completed page capture plus metadata.
- Read persisted `module:accessibility` verifier receipts into the Site query; only `COMPLETED` applicable receipts establish positive Accessibility coverage. `NOT_APPLICABLE` remains unknown.
- Preserved open-Flag reveal for older views without evidence metadata.
- Updated the product skill and recorded the durable learning in `.agents/learnings/optional-site-cards-require-positive-evidence.md`.

## Evidence

- Red before green: three new evidence/Flag reveal tests failed while `SiteBoard` still discarded every non-starter card.
- `npx vitest run components/sites/__tests__/SiteBoard.test.tsx lib/sites/__tests__/board-card.test.ts lib/sites/__tests__/card-areas.test.ts`: 42/42 passed after implementation.
- Nonincremental TypeScript and scoped ESLint passed.
- `ui:drift-guard`, `product:contract-guard`, `skills:validate`, `completeness:audit`, and `git diff --check` passed.
- Read-only local PostgreSQL evidence found completed scans with persisted applicable Accessibility receipts.
- Real local anonymous Site page backed by the stored `example.net` scan rendered healthy Uptime and Accessibility cards at desktop and 375×812. Mobile had `scrollWidth === innerWidth === 375`; browser logs contained no warnings or errors.
- Final `npm run agent -- verify`: all 30 selected commands passed, including database validation/drift, nonincremental TypeScript, lint, 5,720 unit tests, coverage, accuracy evaluation, optimized Next build, worker build and container build. Receipt: `.agent-runs/2026-10-01T11-12-24-612Z-container-build.log`.

## Limits

This is local implementation evidence, not a production release or customer validation. The existing exact-SHA canary, external-client and paid-checkout gates remain open. The unrelated JEV working-tree changes were preserved.
