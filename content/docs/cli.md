## Availability

The CLI is an optional convenience for terminal workflows and editor configuration. The install command is shown only when the exact public npm release is verified.

Direct remote MCP setup remains the primary connection path and does not require the CLI.

## Install

When a verified package is available, install the exact version shown in FixFlags. Do not copy an unverified package command from an old guide.

## Authenticate

Authenticate through the supported CLI login flow or use an API key created from the authenticated FixFlags setup wizard. Store credentials outside project-tracked files.

## Configure an editor

The CLI can configure Cursor, Claude Code, Windsurf, and Codex. Hosted editors use the [authenticated integration setup](/docs/integrations) instead.

`--editor all` means every editor the CLI can configure automatically. Existing valid configuration is preserved and updates are idempotent.

## Product review and update review

Use the CLI to start a product review for a public URL, inspect its status, and fetch the completed report. After deploying a fix, run an update review against the original report.

## JSON and CI

Use JSON output for scripts and CI. Treat non-completed checks as incomplete work, not as successful empty results. Never print or persist API keys in CI logs.
