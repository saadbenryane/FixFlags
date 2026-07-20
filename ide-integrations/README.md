# FixFlags IDE Integrations

FixFlags integrates directly into your AI coding editor. Test your app without leaving your workflow.

## Cursor

Install the FixFlags rules for Cursor:

```bash
mkdir -p .cursor/rules
cp ide-integrations/cursor/fixflags.mdc .cursor/rules/
```

Then restart Cursor. Ask it to "scan my app" and FixFlags runs automatically.

## Claude Code

Add the FixFlags skill to Claude Code:

```bash
claude plugin marketplace add https://github.com/fixflags/claude-code-skill
claude plugin i fixflags-skill@fixflags-marketplace
```

Ask Claude to "test my URL" and it uses FixFlags MCP tools.

## Kiro

Import the FixFlags power from GitHub:

1. Open Kiro IDE
2. Powers panel → Add Custom Power → Import from GitHub
3. Enter: `https://github.com/fixflags/kiro-power`

## How it works

All three integrations use the FixFlags MCP server (14 tools). The rules/skill/power tell your AI editor how to call `ff_check_url`, `ff_get_report_flags`, and other FixFlags tools.

## Requirements

- FixFlags account with API access (Pro or Agency plan)
- API key from https://fixflags.com/settings
- MCP server configured in your editor
