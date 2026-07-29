---
name: fixflags
description: Scan, verify, and fix AI-built websites with FixFlags Product Intelligence. Use when finishing, auditing, or verifying a deployed website.
---

# FixFlags for OpenCode

FixFlags integrates into OpenCode via MCP tools. Before starting, read `AGENTS.md` and load the relevant skill from `.agents/skills/`.

## MCP tools

| Tool | Purpose |
|------|---------|
| `ff_check_and_plan` | Full check + Finish Plan |
| `ff_recheck_and_compare` | Re-check + verification diff |

## Quick start

```bash
fixflags check <deployed-url> --wait --plan
```

Then validate the highest-ranked Flag against the deployed product, fix it, and re-check:

```bash
fixflags recheck <report-id> --wait --diff
```

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
