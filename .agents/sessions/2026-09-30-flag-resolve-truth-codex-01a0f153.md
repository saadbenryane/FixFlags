# Flag resolution proof takeover

**Owner:** `codex-01a0f153`

**Status:** locally implemented and verified; not deployed or customer-validated

**Commit:** `76462eed`

**Scope:** finish the inherited `flag-resolve-truth-2026-09-29` customer path after the user explicitly transferred stale board ownership

## Customer outcome

A Watch recovery email now opens the exact historical Flag that contains FixFlags' independent recovery proof. The proof page accepts only a completed audit owned by the same Site and describes what that check established at that time, rather than making an unbounded claim about the current page.

## Existing implementation retained

Commit `89ed9cdb` already added the Resolved list, propagated `resolvedInId`, rendered proof on Flag detail, and hid Fix/Verify after independent resolution. Commit `8dd34a4c` repaired its Server Component build boundary. Those foundations remain intact.

## Defect found during takeover

The recovery email selected its destination from `child.flags` and tried to match `summary.fixed`. A genuinely fixed Flag is absent from the child by definition, so this branch could never choose the recovered Flag. The prior board claim that recovery email reached proof was therefore not supported by the implementation.

## Implementation

- Added the exact persisted Flag ID to diff summaries: parent ID for fixed/inconclusive items and child ID for unchanged/regressed/new items.
- Made Watch choose the lead destination directly from the ordered summary IDs, preserving regression/new priority before recoveries.
- Removed the now-unnecessary child Flag payload from the notification read.
- Scoped proof-audit lookup to the same `projectId` and `COMPLETED` status.
- Reworded proof as a dated observation: that check no longer found the problem.
- Corrected the Resolved-list guidance so it says the proof and time appear after opening a Flag.

## Evidence

- Focused suite: 3 files, 56 tests passed.
- Non-incremental TypeScript and scoped ESLint passed.
- UI drift, copy drift, product contract, route contract, and completeness gates passed.
- Optimized Next production build passed, including the dynamic Flag detail and Flags list routes.
- `git diff --check` passed.
- Full `npm run agent -- verify` stopped at `db:check` because PostgreSQL was unavailable at `localhost:5432`. `npm run doctor` reported both PostgreSQL and Redis unavailable. `docker compose up -d` could not start them because the configured OrbStack Docker socket did not exist. This is an environment limitation, not a green database receipt.

## Limits and next action

No email was sent and production was not changed. The behavior is not production-verified or customer-validated. Release remains subject to the existing release authority and credentialed release gates. When a database/container runtime is available, rerun `npm run doctor` and the full 30-command verifier before release.
