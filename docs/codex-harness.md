---
status: canonical
authority: operations
reviewed_at: 2026-10-09
supersedes: []
---

# Codex working modes and optional tools

FixFlags uses GPT-6.1 Sol at medium reasoning, low visible verbosity, and
Standard speed by default. Standard speed is represented by leaving
`service_tier` unset; do not select Fast or Ultrafast for routine work. The
model and reasoning controls in the composer or CLI apply to the current chat
and take precedence over the project defaults.

## Working modes

| Mode     | Session choice               | Use it for                                                                         |
| -------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| Quick    | GPT-6 Luna, high             | Search, classification, mechanical transformations, and tightly specified fixes    |
| Standard | GPT-6.1 Sol, medium          | Normal implementation, debugging, and product work                                 |
| Deep     | GPT-6.1 Sol, high or `xhigh` | Ambiguous architecture, difficult debugging, security, and consequential decisions |
| Frontier | GPT-6.1 Sol, high first      | Novel research and conflicting evidence; Astra requires an explicit user choice    |

CLI examples from the repository root:

```bash
# Quick
codex -C . -m gpt-6-luna -c 'model_reasoning_effort="high"'

# Standard (uses .codex/config.toml)
codex -C .

# Deep
codex -C . -m gpt-6.1-sol -c 'model_reasoning_effort="high"'

# Frontier, with current web research available
codex -C . -m gpt-6.1-sol -c 'model_reasoning_effort="high"' --search
```

"Frontier" is a behavior contract, not an automatic Astra switch. Verify the
chat setting, use primary sources, test the strongest competing explanation,
delegate only independent questions, and synthesize one decision.

## Project agents

The project exposes three read-only roles under `.codex/agents/`:

- `scout`: Luna High for focused repository mapping.
- `reviewer`: GPT-6.1 Sol High for a final review of consequential changes.
- `researcher`: GPT-6.1 Sol Medium for explicit primary-source research.

Ask for a role by name. Do not delegate serial work or duplicate exploration
the parent already completed. Three concurrent subagents is a ceiling, not a
target. Each role returns only a conclusion, evidence, uncertainty, and a
recommended action.

## Optional tool profiles

Project settings deliberately disable optional plugins and MCP servers. A CLI
`-c key=value` override applies only to that invocation and is the preferred
way to opt in. Start a fresh desktop chat after changing a project capability;
the project override otherwise continues to win over the user-level setting.
Workspace-managed remote plugin packages cannot be disabled by a repository
config file. FixFlags disables their app/connector tools through
`apps._default.enabled = false`; installation and skill availability remain a
user or workspace setting.

### FixFlags dogfood

```bash
codex -C . -c 'mcp_servers.fixflags.enabled=true'
```

### Browser or native UI proof

```bash
# Browser automation
codex -C . \
  -c 'plugins={ "browser@openai-bundled" = { enabled = true }, "unified-computer-use@openai-bundled" = { enabled = true } }'

# Native-app automation: add both overrides below
codex -C . \
  -c 'plugins={ "computer-use@openai-bundled" = { enabled = true } }' \
  -c 'mcp_servers.computer-use.enabled=true'
```

Enable these only when the task needs interactive reproduction or visual
evidence. Playwright code and repository tests do not require desktop browser
control.

### Artifact production

Enable exactly one required artifact plugin. Examples:

```bash
codex -C . -c 'plugins={ "documents@openai-primary-runtime" = { enabled = true } }'
codex -C . -c 'plugins={ "pdf@openai-primary-runtime" = { enabled = true } }'
codex -C . -c 'plugins={ "spreadsheets@openai-primary-runtime" = { enabled = true } }'
codex -C . -c 'plugins={ "presentations@openai-primary-runtime" = { enabled = true } }'
```

Template creation and visualization remain separate explicit choices:

```bash
codex -C . -c 'plugins={ "template-creator@openai-primary-runtime" = { enabled = true } }'
codex -C . -c 'plugins={ "visualize@openai-bundled" = { enabled = true } }'
```

### Research and review

Web research uses the built-in search surface and needs no plugin:

```bash
codex -C . --search
```

Use the project `reviewer` agent for focused diff review. Enable the generic
code-review plugin only for a task that explicitly requires its separate
workflow:

```bash
codex -C . -c 'plugins={ "code-review@openai-bundled" = { enabled = true } }'
```

If a required capability is unavailable, state what is missing and request the
smallest relevant profile. Do not inventory disabled tools during ordinary
coding work and do not substitute an unrelated tool.

## Cost discipline

Optimize credits per accepted result, not tokens in isolation. Avoid repeated
searches, duplicate reviewers, unnecessary full-suite verification, and
subagents whose context would overlap the parent. Never commit raw prompts,
model outputs, source excerpts, secrets, or customer data as telemetry.

Configuration syntax follows the official [Codex configuration
reference](https://learn.chatgpt.com/docs/config-file/config-reference),
[subagent guide](https://learn.chatgpt.com/docs/agent-configuration/subagents),
and [CLI reference](https://learn.chatgpt.com/docs/cli/reference).
