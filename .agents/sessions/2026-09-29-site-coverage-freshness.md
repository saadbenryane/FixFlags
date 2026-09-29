# Broad Site coverage expires

Date: 2026-09-29. Owner: codex-01a0ec19. Scope: `site-coverage-freshness-2026-09-29`.

## Customer problem and decision

`buildCoverageFacts` previously returned `Looking good` for a completed category check regardless of age. `siteCardHealth` could then return a healthy Site answer indefinitely. That contradicts `knowledge/evidence-rules.md`, which requires scope and freshness for a healthy claim. An old broad Site audit is still evidence of what happened then; it cannot certify that the Site works now.

The broad Site check now has an eight-day validity window, the slowest weekly Watch cycle plus one day of grace. This is a bounded default for category evidence, separate from each Outcome's stored `validUntil`. After expiry, an area with previously sufficient evidence reads `Check out of date`, keeps its `checkedAt`, and offers a new check as the next action. An open Flag still leads as a problem. Missing evidence stays `Not checked yet`; failed work stays `Couldn't verify`; an in-flight check continues to show checking. The Site card cannot show a healthy all-clear from expired starter areas.

The Site query now captures one `now` and passes it to coverage and health. The pure functions require the clock. This implements the prevention described in `.agents/learnings/a-defaulted-clock-turns-call-sites-into-time-bombs.md`; old hardcoded fixture dates no longer change meaning when CI runs later.

## Proof

- Red before change: a nine-day-old completed check with metadata, PageSpeed and flow evidence returned a healthy Search area instead of `Check out of date`.
- Green after change: 3 focused test files, 26 tests passed. The regression checks the exact eight-day boundary, stored time, visible Site and Search card status, and open-Flag precedence. The existing failed and checking paths remain green.
- Scoped ESLint, `copy-drift-check`, `ui:drift-guard`, `knowledge:duplication-guard`, and `git diff --check` passed.
- A nonincremental `tsc --noEmit` completed but failed on the separate in-progress Wave 1 journey code: `SiteOutcomeConfirm.tsx` choice type, two `run-goal-probe.ts` PathStepLabel mismatches, and a duplicate `BrowserJourneyConfig` import in `checkout-execution.ts`. It reported no error in this scope. These files are not mine to alter.
- `npm run agent -- verify --dry-run` planned 30 checks because a different owner's `package.json` research edit is present. Full verification has not completed for this scope.

## Limits and next action

This is local code and projection proof, not a production or customer observation. The eight-day default has not been validated against retention or alert expectations. Daily Watch's missed schedule is separately surfaced as delayed; this window bounds the broad category pass even for manually checked Sites. The active Outcome confirmation contract gaps remain with opencode in `.agents/handoffs/outcome-confirmation-review-2026-09-29.md`.

Before release, complete TypeScript and full required checks on a settled tree, then exercise an authenticated Site with an expired completed audit and with a current audit. Keep unrelated in-progress goal-probe and JEV files under their owners.
