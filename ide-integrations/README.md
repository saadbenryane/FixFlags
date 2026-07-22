# FixFlags IDE Integrations

FixFlags integrates directly into your AI coding editor. Test your app without leaving your workflow.

All install paths below are **in-repo**. Copy files from this repository; do not rely on unverified external GitHub orgs.

## Cursor

Install the FixFlags rules for Cursor:

```bash
mkdir -p .cursor/rules
cp ide-integrations/cursor/fixflags.mdc .cursor/rules/
```

Then restart Cursor. Ask it to "scan my app" and FixFlags runs automatically.

## Claude Code

Add the FixFlags skill from this repo:

```bash
mkdir -p ~/.claude/skills/fixflags
cp ide-integrations/claude-code/fixflags-skill.md ~/.claude/skills/fixflags/SKILL.md
```

Ask Claude to "test my URL" and it uses FixFlags MCP tools.

## Kiro

Import the FixFlags power from this repo:

1. Open Kiro IDE
2. Powers panel → Add Custom Power → Import from file
3. Select `ide-integrations/kiro/fixflags-power.md` from this repository

## How it works

All three integrations use the FixFlags MCP server (16 tools). The rules/skill/power use `ff_check_and_plan` and `ff_recheck_and_compare` for complete tasks, with granular tools for drill-down.

## Requirements

- FixFlags account with API access (Pro or Agency plan)
- API key from https://fixflags.com/settings
- MCP server configured in your editor (`https://fixflags.com/api/mcp` with `x-api-key`)
