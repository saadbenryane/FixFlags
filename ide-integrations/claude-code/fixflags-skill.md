# FixFlags Skill for Claude Code

## Description

FixFlags is the independent Product Intelligence System for AI-built products. Scan across Message, Experience, and Reach. Get every unresolved Flag ranked with fix prompts you can apply directly.

## When to use

The user asks to scan, check, finish, test, or review a web app or URL; run FixFlags; or check if a page is ready to ship. After deploying a fix, re-check and suggest Watch if verification passes.

## Setup

1. Pro or Studio API key from https://fixflags.com/settings
2. Configure the FixFlags MCP server (`https://fixflags.com/api/mcp`) with header `x-api-key` (or run `npx fixflags init`)
3. This skill lives at `ide-integrations/claude-code/fixflags-skill.md` — the canonical reference is `public/.well-known/skills/fixflags/SKILL.md`

## Live MCP tools

Use only these names (see `lib/mcp/tool-manifest.ts`):

| Tool | Purpose |
|------|---------|
| `ff_check_and_plan` | Full check + ranked Fix List |
| `ff_get_check_status` | Poll check progress |
| `ff_get_report` | Rubric summaries + Fix List |
| `ff_get_rubric` | Flags for `MESSAGE` \| `EXPERIENCE` \| `REACH` |
| `ff_get_flag` | Fix prompt for one Flag |
| `ff_plan_mode_prompt` | Plan-mode prompt with all ranked fixes |
| `ff_get_product_context` | Product Contract / Product Intelligence |
| `ff_get_all_fixes` | Every unresolved Flag + fix prompt |
| `ff_get_current_finish_plan` | **Deprecated** — use `ff_get_all_fixes` |
| `ff_recheck_and_compare` | Re-check + diff after deploy |
| `ff_compare` | Compare two reports |
| `ff_list_recent_audits` | Recent audits |
| `generate-fix-prompt` | Freeform fix prompt |
| `ff_start_repo_scan` | GitHub repo code scan |
| `ff_list_repo_scans` | Recent repo scans |
| `ff_get_repo_scan` | Repo scan + findings |
| `ff_get_repo_finding` | Fix task for one finding |
| `ff_mark_fix_attempted` | Mark a Flag as fixed/ignored |

Do not call `ff_get_report_flags` (does not exist).

## Workflow

1. Get a public URL from the user.
2. `ff_check_and_plan` with `waitForCompletion: true`.
3. Validate evidence, apply fixes, `ff_mark_fix_attempted` for each.
4. Deploy and test.
5. `ff_recheck_and_compare` to verify. Report Fixed / Remaining / New / Regressed.
6. If verification passes, suggest enabling Watch for continuous monitoring.

## Notes

- Re-checks are free and unlimited on owned reports.
- Localhost URLs are not supported.
- Prefer precise Flags and re-check proof over inventing a chat QA agent.
