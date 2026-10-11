---
status: canonical
authority: operations
reviewed_at: 2026-10-10
supersedes: []
---

# Codex project configuration

The user-selected model and reasoning settings control the current chat. Repository configuration must not silently replace them.

## Project roles

Read-only roles under `.codex/agents/` are optional:

- `scout` locates execution paths and focused tests.
- `reviewer` checks consequential security, billing, authentication, data-flow, or architecture diffs.
- `researcher` gathers current primary-source evidence when external research is explicitly needed.

Use a role only for an independent question. Do not delegate serial work or duplicate exploration already completed in the parent task.

## Optional capabilities

`.codex/config.toml` keeps nonessential plugins and connectors disabled for ordinary repository work. Opt in only to the capability the task needs, preferably for one invocation.

Examples:

```bash
# FixFlags dogfood MCP
codex -C . -c 'mcp_servers.fixflags.enabled=true'

# Browser automation
codex -C . \
  -c 'plugins={ "browser@openai-bundled" = { enabled = true }, "unified-computer-use@openai-bundled" = { enabled = true } }'

# Current web research
codex -C . --search
```

Artifact plugins should be enabled individually only when producing that artifact type. Playwright code and repository tests do not require desktop browser control.

If a required capability is unavailable, state the missing capability and request the smallest relevant profile. Do not substitute an unrelated tool.

## Context and validation

- Follow [AGENTS.md validation policy](../AGENTS.md#validation): E2E tests, including ad hoc browser test scripts and indirect release-command stages, require an explicit user request.
- `npm run agent -- context <area>` returns a narrow authority map; it does not require reading every source.
- Choose focused checks from the files actually changed for the task.
- Treat unrelated dirty files as unrelated; do not expand validation solely because they exist.
- Use full or release validation only at a real cross-cutting or release boundary.

Avoid repeated searches, duplicate reviewers, raw prompt or tool-output archives, and model telemetry containing source, secrets, customer data, or prompts.
