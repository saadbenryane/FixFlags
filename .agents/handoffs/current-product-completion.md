# Current product completion handoff

## Status

Paused for workspace coordination on 2026-07-22. Another Codex task is actively
editing the same `main` worktree without a board claim. It changed report, share,
claim, Finish Plan, MCP, and task-contract files while browser verification was
running. Do not overwrite or discard those changes.

## Completed in this task

- Added canonical `checkAndPlan` and `recheckAndCompare` application services.
- Cut web, MCP, and CLI task flows over to the canonical contracts.
- Removed legacy audit routes, app redirects, plaintext share-password support,
  obsolete anonymous-limit aliases, and CLI server-compatibility fallbacks.
- Hardened Product Watch concurrency and notification idempotency.
- Added CLI beta metadata and MIT license; removed tracked generated CLI output.
- Added Playwright/CI gates, CLI tests, knowledge validation, and documentation
  and skill updates.
- Updated dependency pins and removed high/critical audit findings.

## Verification before the collision

- Typecheck: passed.
- Lint: passed.
- Target Vitest suites: 45 tests passed.
- Knowledge and UI drift guards: passed.
- Public Playwright smoke tests: four passed. The remaining two were invalidated
  by repeated hot reloads caused by concurrent file edits.

## Resume checklist

1. Wait until the worktree has stopped changing and reconcile every overlapping
   file, especially `lib/audit/task-contracts.ts`, `lib/audit/finish-plan.ts`,
   `lib/mcp/tools.ts`, report pages/components, sharing, and claim logic.
2. Confirm `origin/main` is an ancestor of `main` and review all commits made by
   the concurrent task.
3. Run CLI tests and package dry-run/clean-install validation.
4. Run database validate/status/drift, full unit/script/guard/capability suites,
   application and worker builds, E2E, and Docker build.
5. Do not publish the CLI until the canonical server contract is deployed and
   production smoke tests pass. Check npm authentication at that point.

