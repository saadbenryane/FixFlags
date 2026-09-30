# Outcome confirmation semantic integrity

**Owner:** `codex-01a0f153`

**Status:** locally implemented, independently reviewed and verified; not deployed or customer-validated

**Scope:** the confirmation, rename and withdrawal boundary for Site Outcomes

## Customer outcome

FixFlags no longer lets a confirmation silently change a known Outcome into a different promise. A generic inference becomes one canonical executable Outcome, protected Outcomes explain why they cannot be watched yet, and a customer can rename a confirmed Outcome without changing its confirmation time, execution binding or evidence.

## Implementation

- Moved browser-safe Outcome kind names and currently watchable choices into `lib/sites/outcome-kinds.ts`; the client now imports the database-backed Outcome module only for types.
- Known inferred kinds may confirm only as themselves. A crafted or stale request that tries to turn Signup into availability or Checkout is refused with `OUTCOME_KIND_MISMATCH`.
- A generic inference receives the canonical name for the mechanism it selects, so a broad sentence is not shown as verified merely because HTTP availability passed.
- Added an explicit `RENAME_OUTCOME` route and command. Rename changes only `name` and `inferenceSource`, preserving `confirmedAt`, kind, bindings, assessments and execution history. The server-rendered row refreshes after success.
- Confirmation, reconfirmation and withdrawal acquire a project- or provisional-Site-scoped PostgreSQL row lock before reading state. Binding retirement/install and semantic updates happen in one transaction.
- Same-kind confirmation is idempotent: it preserves a later customer rename and the original confirmation time. Withdrawal disables active bindings before clearing confirmation.
- Added domain, route, component, command and real PostgreSQL concurrency regressions.

## Evidence

- Focused post-repair suite: 6 files, 51 tests passed.
- Local PostgreSQL integration: 3/3 passed. Eight confirmation/withdrawal races preserved the binding/confirmation invariant; repeated same-kind confirmation preserved label/time; a Site A request returned without waiting on a held Site B row lock and left Site B unchanged.
- Non-incremental TypeScript, scoped ESLint, UI/copy/module-boundary guards and `git diff --check` passed.
- Independent read-only review initially found broken rename routing, server-side reclassification, non-atomic writes and a Prisma-backed client import. Follow-up review found and drove repairs for concurrent withdrawal, stale same-kind confirmation and the tenant scope of the row lock. Final review reported no actionable P0-P2 findings.
- The first final full run reached the unit suite but one unrelated existing SEO test timed out at 30 seconds; its isolated rerun passed in 886 ms. A clean retry passed all 30 commands: 470 test files passed, 5,708 tests passed, schema drift was clear, security audit reported zero vulnerabilities, Next and worker builds passed, and the container built. Container receipt: `.agent-runs/2026-09-30T15-31-14-721Z-container-build.log`.

## Limits and next action

This is local evidence only. The change was committed on local `main`; no branch was pushed and production was not changed. The real production confirmation/rename path remains unverified until the local commit is deliberately released under existing authority. Protected Signup, Login and Password reset Outcomes remain unavailable until tenant-scoped credentials and reversible fixtures exist.

After the verified implementation was committed locally, strict local release continuity passed. `npm run agent -- eval release` then stopped safely at the foundation receipt. The environment has an AI provider key, but `RELEASE_FRESH_DATABASE_URL`, explicit `RELEASE_ALLOW_DATABASE_RESET`, `RELEASE_CONTAINER_ENV_FILE`, `RELEASE_SMOKE_URL` and `PRODUCTION_URL` are absent. No secret values were printed, no database was reset, `main` was not pushed and production remains unchanged.
