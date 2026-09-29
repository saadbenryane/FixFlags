# Restore the experimental adapter's build contract

Owner: codex-01a0ec19. Task: `restore-ci-triage-adapter-2026-09-29`. Base: `cd871788` (product files introduced in `fa960fae`).

## Evidence and scope

GitHub's direct Actions API identifies [CI run 36562694752](https://github.com/saadbenryane/FixFlags/actions/runs/36562694752) on `fa960fae` as failed in `validate:full`. Check run 109387095223 reports missing JEV answer type imports, a nonexistent prompt-module context export, and a missing typed environment property. The initial `gh run list --branch main` result showed only September 13 runs; querying the current SHA and direct Actions API corrected that stale observation.

The commit message called `fa960fae` documentation-only, but its actual diff added `lib/audit/jev-client.ts` and `jev-triage.ts`. Older green validation receipts therefore do not apply to that commit. A fresh local typecheck reproduced the failures and also found a widened assessment-state type and an obsolete output property.

Repair preserves the unconnected experiment and leaves the shipped OpenAI/Anthropic chain unchanged:

- Import the existing exported answer types.
- Export/reuse the existing context builder from `judge-triage.ts`, where its implementation actually lives.
- Use the existing process environment key directly, so this repair is self-contained and does not require another agent's uncommitted environment-schema addition.
- Preserve the assessment-state union; remove obsolete `enrichments` from the returned triage contract.
- Remove unused imports/private arguments and explicitly retain unsupported public adapter parameters without lint errors.

This does not establish JEV accuracy, cost advantage, image coverage, or production readiness. The separate research author's uncommitted tests, script, environment/schema, package command, and learning files were preserved and excluded from this repair's commit.

## Verification

- Baseline `npm run typecheck`: failed, matching GitHub errors.
- First repair typecheck exposed obsolete `enrichments`; fixed before the passing run.
- `npm run agent -- verify --dry-run`: 11 selected commands.
- `npm run agent -- verify`: passed all 11, including nonincremental typecheck, full lint, audit suite (1,619 passed, 9 skipped), and selected guards. Receipt: `/tmp/fixflags-ci-adapter-verify.log`; logs `.agent-runs/2026-09-29T13-57-*`.
- Full `npm run verify`: passed 5,623 unit tests (15 skipped), coverage, schema/drift, lint/typecheck, security and preceding guards, then **failed production build** on `components/sites/SiteFlagsView.tsx` importing `useSearchParams` without a client boundary. Full log: `/tmp/fixflags-ci-adapter-full.log`. Do not describe this as a full pass.
- On the 17:49 UTC resume, all three repaired source files had reverted to their HEAD contents (mtime 15:23:57 local); the cause is unknown. The separate research learning explicitly leaves this already-claimed build repair to this task. Reapplied only the owned repair, preserving every intervening research file.
- Current restored repair: nonincremental typecheck passed (process 14799, `/tmp/fixflags-ci-reconcile-typecheck.log`); scoped lint passed; existing triage and research client suites passed 21 tests. After restoring direct environment lookup, all 8 client tests passed again with HTTP mocked; no paid provider request ran.
- Diff whitespace check passed. Current product build remains blocked by the distinct Flags-view client-boundary defect, not by the adapter type errors. No remote CI-green or deployed-repair claim is made.

## Release and next action

Foundation and external release preflights still report missing disposable database/container/reset authorization and release/Watch fixtures. Railway's authenticated CLI status request terminated with a network timeout; do not infer deployment status from that failure. Public health last observed `e72228e8` healthy, not this repair.

Hand the independent Flags-view build failure to its active `flag-resolve-truth-2026-09-29` owner via `.agents/handoffs/ci-flags-client-boundary-2026-09-29.md`. After that boundary is repaired, rerun the production build and current release gates; do not repeat already-completed tests solely because time passed. Keep JEV disabled until its separate research and evidence contract are complete.

Method lesson: inspect the staged file list and the actual commit diff, not a commit's prose, before classifying it as docs-only or reusing a green receipt. Shared-checkout changes must be committed or durably handed off before interruption, with exact verification scope and outstanding failures.
