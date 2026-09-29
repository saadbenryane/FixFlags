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
- Read-only real local database path: completed project audits are dated 2026-09-23, so none was past the eight-day window at the real clock. I confirmed each selected Project's latest audit is `COMPLETED`, then called the actual `loadSiteHome` query for three Sites. Each preserved its open-Flag priority (1, 12 and 2 Flags respectively); unevidenced cards remained `Not checked yet`. No database row was changed. This checks fresh-state integration, not production proof.
- Read-only stale-state query path: the database is the local `localhost:5432/fixflags` instance. I called `loadSiteHome` for project `cmueq4k5d0021gukckpx2ovk5` with the real clock, then called it again in the same isolated process with only `Date` advanced to 2026-10-03T12:00:00Z. Its completed audit stayed at 2026-09-23T23:18:26.675Z. The Conversion card changed from healthy `Last checked` (Score 92) to unknown `Check out of date` with `Run a new check for current evidence`, while retaining `checkedAt`; the Site card still led with its one open Flag. The clock override was restored, Prisma disconnected, and no database row changed. This proves the real query projection under an expired clock, not an authenticated browser or production path.
- `npm run agent -- verify --dry-run` planned 30 checks because a different owner's `package.json` research edit is present. Full verification has not completed for this scope.

## Limits and next action

This is local code and projection proof, not a production or customer observation. The eight-day default has not been validated against retention or alert expectations. Daily Watch's missed schedule is separately surfaced as delayed; this window bounds the broad category pass even for manually checked Sites. The active Outcome confirmation contract gaps remain with opencode in `.agents/handoffs/outcome-confirmation-review-2026-09-29.md`.

Later customer-surface review found a limit in the anonymous Site board: `isEmptyUncheckedCard` in `components/sites/SiteBoard.tsx` hides any unknown category with no Flag or checking activity. The real shifted `loadSiteHome` Conversion card is stale with historical `checkedAt` but meets that predicate, so signed-out visitors lose that expired area card. The UI file belongs to `anon-site-dashboard-ux` (grok, review); exact reproduction and acceptance are in `.agents/handoffs/anonymous-stale-card-2026-09-29.md`. Also, the stale detail says "Run a new check" without a direct broad Site run control; the existing `/api/sites/[siteId]/runs` route requires an Outcome. Treat both as remaining customer-path gaps, not completed coverage recovery.

Before release, complete TypeScript and full required checks on a settled tree, then exercise an authenticated Site with expired and current evidence in the rendered interface. Keep unrelated in-progress goal-probe and JEV files under their owners.
