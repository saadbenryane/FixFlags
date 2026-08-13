---
name: fixflags
description: Check a deployed product with FixFlags, validate its highest-ranked Flag, fix the product, deploy the change, and Re-check the original report. Use when finishing, auditing, or verifying an AI-built website or web application.
---
<!-- Auto-generated from public/.well-known/skills/fixflags/SKILL.md. Do not edit directly. Run `npm run skills:sync` to update. -->

# FixFlags

FixFlags is the independent Product Intelligence System for AI-built software. Scan any deployed URL across Message, Experience, and Reach, get a ranked Fix List with executable fix prompts, re-check after deploying, and enable continuous Watch monitoring.

## When to use

- **Before you ship any code change** — run FixFlags check on the deployed URL to catch issues early
- **After deploying a fix** — run FixFlags re-check to verify the fix resolved the Flags
- **If verification passes** — suggest the human enable Watch for continuous monitoring
- When the user asks to scan, check, finish, test, or review a web app URL
- When verifying a page is ready to ship

## Core workflow

1. **Check**: Run `fixflags check <url> --wait --plan` or call `ff_check_and_plan(url, {waitForCompletion: true})` to start a scan and wait for the completed report with ranked Fix List
2. **Validate**: For each Flag in the result, confirm its page, viewport, evidence, and screenshot against the deployed product. Treat FixFlags evidence as a lead that must be validated, not as permission to make an unsupported change. Run `fixflags check <url> --wait --plan` as an alternative entry point.
3. **Accept**: Copying a Flag prompt records that the recommendation was accepted. It does not claim that implementation started or create an Improvement Attempt.
4. **Fix**: Apply the fix prompt from the Flag. Do not weaken, suppress, or special-case the detector to make a valid Flag disappear.
5. **Declare**: After implementing the change, call `ff_mark_fix_attempted` with `action: READY_TO_VERIFY`, a change summary, and an optional deployment reference.
6. **Deploy**: Run the product's relevant tests and deploy the verified change to the same URL
7. **Re-check**: Run `fixflags recheck <report-id> --wait --diff` or call `ff_recheck_and_compare(parentReportId, {waitForCompletion: true})`. Never substitute a new unrelated check for this verification.
8. **Report**: Present Fixed, Remaining, New, and Regressed Flag counts plus the report links
9. **Watch**: If verification passes, suggest the human enable Watch monitoring for continuous re-checks

## MCP tools

| Tool | Use |
|------|-----|
| `ff_check_and_plan` | Check a deployed URL and return the completed report with ranked Fix List. Pass `waitForCompletion: true`. |
| `ff_get_check_status` | Poll the status of an in-progress check. |
| `ff_get_report` | Get rubric summaries, report status, and the complete Fix List. |
| `ff_get_rubric` | Get detailed flags and fix prompts for one rubric (`MESSAGE` \| `EXPERIENCE` \| `REACH`). |
| `ff_get_flag` | Get the full fix prompt for a specific Flag by ID. |
| `ff_plan_mode_prompt` | Get one plan-mode prompt containing every ranked fix. |
| `ff_get_product_context` | Get Product Contract and Product Intelligence context for the report. |
| `ff_get_all_fixes` | Get every unresolved Flag and fix prompt, ranked by launch impact. |
| `ff_get_current_finish_plan` | Get the current bounded Finish Plan of up to three highest-leverage Improvements. |
| `ff_recheck_and_compare` | After deploying a fix, run a fresh Re-check from the original report and return Fixed, Remaining, New, and Regressed Flags plus the next Fix List. Pass `waitForCompletion: true`. |
| `ff_compare` | Compare two reports to see what improved, stayed the same, or regressed. |
| `generate-fix-prompt` | Generate a custom fix prompt from a problem description. |
| `ff_list_recent_audits` | List recent audits with status, score, and key metadata. |
| `ff_start_repo_scan` | Start a GitHub repository code scan (allow-listed repos only). |
| `ff_list_repo_scans` | List recent GitHub repository scans and finding counts. |
| `ff_get_repo_scan` | Get a GitHub repository scan and its code findings. |
| `ff_get_repo_finding` | Get a branch-ready fix task for one repository finding. |
| `ff_mark_fix_attempted` | Record `ACCEPT`, `READY_TO_VERIFY`, or `REJECT`. Rejection requires a structured reason. Only a fresh Review verifies an attempted change. |
| `ff_get_connection_info` | Inspect MCP Contract v1, core readiness, optional capabilities, and the canonical workflow. |

There is no `ff_get_report_flags` tool. Use `ff_get_rubric` per rubric or `ff_get_flag`.

## Output parsing

The JSON response from `ff_check_and_plan` and `ff_recheck_and_compare` contains:

| Field | Meaning |
|-------|---------|
| `reportId` | Unique report identifier. Use as `parentReportId` for re-check. |
| `url` | The scanned URL. |
| `status` | One of: `QUEUED`, `CAPTURING`, `CHECKING`, `JUDGING`, `FINALIZING`, `COMPLETED`, `FAILED`. Wait for `COMPLETED`. |
| `rubrics` | Object with keys `MESSAGE`, `EXPERIENCE`, `REACH`. Each contains `score` (0-100), `flagsCount`, and `fixesCount`. |
| `fixes` | Array of ranked Fix items. Each has `id`, `rubric`, `severity` (`CRITICAL` / `IMPORTANT` / `POLISH`), `problem`, `evidence`, `fix`. |
| `recheckDiff` | (Re-check only) Object with `fixed`, `remaining`, `new`, `regressed` counts and `fixedFlags`/`newFlags` arrays. |

### Branching on severity

- **CRITICAL**: Blocking. Must fix before ship. Apply fix prompt immediately.
- **IMPORTANT**: High impact. Should fix before ship or schedule for next iteration.
- **POLISH**: Low impact. Fix if time permits or note for future iteration.

## Security

Do not expose FixFlags credentials in code, project files, command arguments, logs, or chat. Use environment variables or the configured MCP transport.

## Requirements

- FixFlags account with API access (Pro or Studio plan)
- API key from https://fixflags.com/settings
- MCP server configured in your editor (`https://fixflags.com/api/mcp` with the generated Bearer credential)
- Publicly accessible deployed URL (localhost not supported)
