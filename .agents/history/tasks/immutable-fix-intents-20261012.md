# immutable-fix-intents-20261012

- Task: `immutable-fix-intents-20261012`
- Owner: `codex-functional-goal`
- Scope: Make recorded fix intents and admitted verification attempts immutable, idempotent and correctly projected across shared Site/API/MCP paths
- Worktree: `/Users/saadbenryane/Code/FixFlags`
- Started: 2026-10-12T06:51:21.123Z
- Finished: 2026-10-12T08:21:53.092Z

## Outcome

Fix declarations now share immutable keyed Improvement Attempt receipts across Site/API/MCP. Concurrent first-fix requests converge through native conflict-safe materialization. Commit provenance is persisted and returned from recorded data. A PostgreSQL trigger freezes keyed/admitted intent while legacy unkeyed drafts retain guarded preparation updates. Removed the obsolete one-open-attempt-per-source index so distinct repairs can coexist. Reconciliation selects the named attempt and protects the latest repair status under a shared Improvement lock. Board, detail and existing history derive verification activity from admitted execution rather than an unset result. Exact completed retries preserve original history and changed declarations return a safe 409. Preserved unrelated UI/marketing work. Full product goal remains active; broader capability evidence and deployed migration/production/provider proof remain outstanding.

## Evidence

- 197 focused Improvement, Site replay, API and MCP checks passed. Shared Site/admission/finalization/claim checks passed: 510 passed, six explicit gates skipped. History projection and labels: 15 focused checks passed after the final state correction.
- FIX_INTENTS_DB_REQUIRED=true node scripts/verify-progressive-execution.mjs -t "immutable fix intents": full migrations, migration status and schema drift check passed on disposable PostgreSQL. Eight concurrent first-fix retries converged; frozen metadata mutation and unfreezing were prevented; three real worker verification runs reconciled exact repairs, preserved first resolution and validated completed replay, changed declarations, absent legacy description and ownership refusal.
- node scripts/verify-progressive-execution.mjs: 41 main worker, scheduled monitoring, recovery, dispatch and keyboard regressions passed; seven explicit gates skipped. Focused Checkout browser fixtures: five passed with current binding failure identity and persisted failure reference.
- Typecheck, focused ESLint, module boundary guard and git diff --check passed. No deployment or production mutation performed.
