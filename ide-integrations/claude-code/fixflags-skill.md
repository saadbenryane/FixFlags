# FixFlags Skill for Claude Code

## Description

FixFlags is the independent Product Intelligence System for AI-built products. Scan across Message, Experience, and Reach. Get every unresolved Flag ranked with fix prompts you can apply directly.

## When to use

The user asks to scan, check, finish, test, or review a web app or URL; run FixFlags; or check if a page is ready to ship.

## Setup

1. Pro or Agency API key from https://fixflags.com/settings
2. Configure the FixFlags MCP server (`https://fixflags.com/api/mcp`) with header `x-api-key`
3. Keep this skill in-repo at `ide-integrations/claude-code/fixflags-skill.md` (copy into Claude Code skills as needed)

## Live MCP tools

Use only these names (see `lib/mcp/tools.ts`):

- `ff_check_and_plan` — start check (`waitForCompletion` optional)
- `ff_get_check_status` — poll
- `ff_get_report` — rubric summaries
- `ff_get_rubric` — flags for `MESSAGE` | `EXPERIENCE` | `REACH`
- `ff_get_flag` — fix prompt for one flag
- `ff_get_product_context` — Product Contract / Product Intelligence
- `ff_get_all_fixes` — every unresolved Flag + fix prompt
- `ff_get_current_finish_plan` — deprecated three-item Quick Plan
- `ff_plan_mode_prompt` — plan-mode prompt containing every ranked fix
- `ff_recheck_and_compare` — re-check
- `ff_compare` — compare two reports
- `generate-fix-prompt` — freeform fix prompt

Do not call `ff_get_report_flags` (does not exist).

## Workflow

1. Get a public URL from the user.
2. `ff_check_and_plan` with `waitForCompletion: true` (or poll with `ff_get_check_status`).
3. `ff_get_product_context` then `ff_get_all_fixes`.
4. `ff_get_report` for scores; `ff_get_rubric` for each rubric for Flags.
5. Present by Message / Experience / Reach.
6. Apply the fixes; then `ff_recheck_and_compare` to verify.

## Notes

- Re-checks are free and unlimited on owned reports.
- Localhost URLs are not supported.
- Prefer precise Flags and re-check proof over inventing a chat QA agent.
