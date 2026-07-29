# FixFlags IDE Integrations

FixFlags integrates directly into your AI coding editor. Test your app without leaving your workflow.

The canonical skill reference is published at `public/.well-known/skills/fixflags/SKILL.md`.

## Quick install

The primary install path is `npx fixflags init` in your project root. This automatically configures the MCP server and editor-specific settings.

```bash
npx fixflags init https://your-app.com
```

## Per-editor setup

### Cursor

Install the FixFlags rules for Cursor:

```bash
npx fixflags init    # Recommended
# Or manually:
mkdir -p .cursor/rules
cp ide-integrations/cursor/fixflags.mdc .cursor/rules/
```

Then restart Cursor. Ask it to "scan my app" and FixFlags runs automatically.

### Claude Code

Install the FixFlags skill for Claude Code:

```bash
npx fixflags init    # Recommended
# Or manually:
mkdir -p ~/.claude/skills/fixflags
cp ide-integrations/claude-code/fixflags-skill.md ~/.claude/skills/fixflags/SKILL.md
```

Ask Claude to "test my URL" and it uses FixFlags MCP tools.

### Kiro

Install the FixFlags power for Kiro:

1. Open Kiro IDE
2. Powers panel → Add Custom Power → Import from file
3. Select `ide-integrations/kiro/fixflags-power.md` from this repository

Or run `npx fixflags init` for automatic configuration.

### OpenCode

FixFlags skills load automatically from `.agents/skills/`. See `opencode.json` for MCP and tool configuration.

## How it works

All integrations use the FixFlags MCP server. The rules/skill/power use `ff_check_and_plan` and `ff_recheck_and_compare` for complete tasks, with granular tools for drill-down. After verification passes, suggest enabling Watch for continuous monitoring.

## Requirements

- FixFlags account with API access (Pro or Studio plan)
- API key from https://fixflags.com/settings
- MCP server configured in your editor (`https://fixflags.com/api/mcp` with `x-api-key`)
