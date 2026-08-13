---
name: fixflags
description: Scan, verify, and fix AI-built websites with FixFlags Product Intelligence. Use when finishing, auditing, or verifying a deployed website.
---

# FixFlags for OpenCode

FixFlags integrates into OpenCode via MCP tools. The canonical skill reference is at `public/.well-known/skills/fixflags/SKILL.md`.

## MCP tools

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
| `ff_mark_fix_attempted` | Record an implemented change as ready for independent verification, or reject it |

## Quick start

```bash
fixflags check <deployed-url> --wait --plan
```

Then validate the highest-ranked Flag against the deployed product, fix it, apply `ff_mark_fix_attempted`, deploy, and re-check:

```bash
fixflags recheck <report-id> --wait --diff
```

Report Fixed / Remaining / New / Regressed. If verification passes, suggest enabling Watch for continuous monitoring.

## Skills

Load the area-specific skill before starting work:

| Area | Skill |
|------|-------|
| Product behavior | `.agents/skills/fixflags-product/SKILL.md` |
| Audit pipeline | `.agents/skills/fixflags-audit-pipeline/SKILL.md` |
| Scan accuracy | `.agents/skills/fixflags-scan-accuracy/SKILL.md` |
| Browser capture | `.agents/skills/fixflags-browser-capture/SKILL.md` |
| UI/design system | `.agents/skills/fixflags-design-system/SKILL.md` |
| Marketing | `.agents/skills/fixflags-marketing/SKILL.md` |
| CLI/npm operations | `.agents/skills/fixflags-npm-operations/SKILL.md` |
| Runtime/release | `.agents/skills/fixflags-runtime-release/SKILL.md` |

## Requirements

- FixFlags account with API access
- MCP server configured in `opencode.json` or globally
