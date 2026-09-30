# RunRequest renewal race

**Owner:** `codex-01a0f153`

**Status:** locally implemented and verified; not deployed or customer-validated

**Commit:** `b26e9716`

**Scope:** finish the inherited `run-request-lease-recovery-2026-09-29` write-time ownership contract

## Customer outcome

A slow but live Site verification is no longer vulnerable to being marked abandoned merely because the recovery path read its old lease just before the worker renewed it. Watch, web, MCP, deployment, integration, and Flag verification continue to share one safe run command.

## Defect

`reclaimExpiredOutcomeRuns` correctly queried expired and legacy NULL leases, but later wrote `FAILED/RUN_ABANDONED` using only the run ID and active status. Between the read and write, the owning worker could renew the lease. The stale recovery reader would then clobber a live run, release the partial unique index, and allow overlapping verification.

## Implementation

- Repeated the exact expired-or-NULL lease predicate in the terminal `updateMany`, alongside ID and active status.
- Added a regression that returns a stale candidate, simulates renewal before the write, makes the guarded update affect zero rows, and proves the live run is reused without starting another audit.
- Updated the durable lease learning and product skill so future claim recovery treats reads as candidates and conditional writes as authority.

## Evidence

- Focused RunRequest suite: 22 tests passed.
- Non-incremental TypeScript and scoped ESLint passed.
- The earlier real PostgreSQL evidence for the underlying lease and partial unique index remains valid, but this race repair has not received a fresh database run because localhost PostgreSQL, Redis, and the configured OrbStack Docker socket are unavailable.

## Limits and next action

Production was not changed and no real renewal race was induced. When runtime infrastructure is available, rerun `npm run doctor`, the PostgreSQL lease integration, and the full verifier before release under existing authority.
