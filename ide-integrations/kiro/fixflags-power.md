# FixFlags Power for Kiro

## Description

FixFlags is the QA layer for AI-built products. Scan any public web app across Message, Experience, and Reach. Get Flags with fix prompts you can apply in Kiro.

## When to trigger

- User asks to scan, check, test, or review a web app
- User wants to verify a page is ready to ship
- User mentions FixFlags
- After deploying a fix, re-check and suggest Watch if verification passes

## Setup

1. Pro or Studio API key from https://fixflags.com/settings
2. MCP endpoint: `https://fixflags.com/api/mcp` with `x-api-key` (or run `npx fixflags init`)
3. This power file lives at `ide-integrations/kiro/fixflags-power.md` — the canonical reference is `public/.well-known/skills/fixflags/SKILL.md`

## Live MCP tools

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

There is no `ff_get_report_flags` tool.

## Workflow

### Scan a URL

1. Ask for a publicly accessible app URL.
2. Call `ff_check_and_plan` (prefer `waitForCompletion: true`).
3. Call `ff_get_report` for scores and `ff_get_all_fixes` for the complete ranked Fix list.
4. Present by rubric:

| Rubric | What it checks |
|--------|----------------|
| **Message** | Headline clarity, CTA specificity, audience fit, social proof, trust |
| **Experience** | Layout, mobile UX, accessibility, broken interactions |
| **Reach** | SEO metadata, social previews, privacy policy, analytics |

### Fix and re-check

Apply fix prompts in the codebase, call `ff_mark_fix_attempted` for each Flag, then call `ff_recheck_and_compare` on the same URL. Re-checks are free and unlimited on owned reports. If verification passes, suggest enabling Watch for continuous monitoring.

## Notes

- Do not invent a conversational QA agent. Use Flags + fix prompts + re-check.
- Localhost is not supported.
