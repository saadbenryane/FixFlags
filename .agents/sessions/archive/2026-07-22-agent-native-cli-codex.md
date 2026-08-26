# Agent-native CLI

- **Date:** 2026-07-22
- **Owner:** codex
- **Branch:** `main`
- **Status:** complete

## Outcome

Extended the existing `fixflags-cli/` package around two complete agent tasks:

- `fixflags check <url> --wait --plan` returns the completed report plus the current Finish Plan, capped at three items.
- `fixflags recheck <reportId> --wait --diff` performs a fresh monitoring check and returns fixed, remaining, new, and regressed counts plus the next Finish Plan.

`scan` remains an alias. Human output bounds long prompts and exposes `--full`; `--json` returns the structured outcome. Authentication supports `FIXFLAGS_API_KEY` for CI in addition to the local config file.

## Design notes

- Reuses the shipped MCP tools and does not duplicate audit or ranking logic.
- Uses the combined `ff_monitoring` outcome when available.
- Falls back to `ff_compare` / `ff_get_current_finish_plan` for older server responses that only return a child report ID.
- Continues polling if the server-side 90-second wait returns before a check reaches a terminal state.

## Verification

- `cd fixflags-cli && npm test`: 5 passing, including a real built-CLI HTTP contract test.
- `cd fixflags-cli && npm pack --dry-run`: package contains only README, bin, dist, and package metadata.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run brand:hex-guard`: passed.
- `npm run ui:drift-guard`: passed.
- `npm run seo:guard`: passed.
- `npm run test:unit`: 130 files passed, 1,989 tests passed, 1 skipped.
- `npm run build`: passed.

The first full unit run exposed a pre-existing suite-order-sensitive ranking assertion. The same test passed in isolation and the complete suite passed on the immediate rerun. No audit ranking files were changed for this CLI task.
