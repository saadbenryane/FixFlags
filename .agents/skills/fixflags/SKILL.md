---
name: fixflags
description: Check a deployed product with FixFlags, validate its highest-ranked Flag, fix the product, deploy the change, and Re-check the original report. Use when finishing, auditing, or verifying an AI-built website or web application.
---

# FixFlags

The canonical FixFlags agent skill is published at `public/.well-known/skills/fixflags/SKILL.md`. That file is the single source of truth for all agents (Claude Code, Cursor, Windsurf, Codex, OpenCode).

For product behavior and architecture context, load `.agents/skills/fixflags-product/SKILL.md`.

## Quick reference

- **Full skill**: `public/.well-known/skills/fixflags/SKILL.md`
- **MCP tool manifest**: `lib/mcp/tool-manifest.ts`
- **Product context**: `.agents/skills/fixflags-product/SKILL.md`
- **Audit pipeline**: `.agents/skills/fixflags-audit-pipeline/SKILL.md`
- **Scan accuracy**: `.agents/skills/fixflags-scan-accuracy/SKILL.md`
- **Browser capture**: `.agents/skills/fixflags-browser-capture/SKILL.md`

## Core workflow

1. **Check**: `ff_check_and_plan(url, {waitForCompletion: true})`
2. **Validate**: Confirm each Flag's evidence against the deployed product
3. **Fix**: Apply the fix prompt
4. **Mark**: `ff_mark_fix_attempted(flagId)`
5. **Deploy**: Test and deploy
6. **Re-check**: `ff_recheck_and_compare(parentReportId, {waitForCompletion: true})`
7. **Report**: Fixed / Remaining / New / Regressed counts
8. **Watch**: Suggest enabling Watch monitoring if verification passes

## Security

Do not expose FixFlags credentials in code, project files, command arguments, logs, or chat.
