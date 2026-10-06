# MCP client matrix host preflight

**Task:** `mcp-client-matrix-preflight-2026-10-06`
**Status:** host readiness measured; authenticated matrix remains open

## Evidence

- `codex --version` returned `codex-cli 0.155.1`.
- `codex mcp list` showed a FixFlags server enabled. Environment values were redacted by the client.
- The repository CLI's `whoami` path returned `Not authenticated`; there is no usable FixFlags credential in its configured credential store on this host.
- `claude --version` returned Claude Code `2.1.278`.
- `claude mcp list` showed FixFlags as `Pending approval`; the client must be opened interactively to approve it before an authenticated session can run.
- `cursor` was not found on this host.

## Decision

Configuration compatibility is not an authenticated matrix pass. No Site or Outcome was listed, no run was started, no Flag or recovery was exercised, and no credential value was read or printed. The release matrix remains gated until an operator:

1. authenticates the FixFlags CLI with an explicit read-only key and proves `fixflags.run` is rejected with `INSUFFICIENT_SCOPE`;
2. repeats with a non-expired Fix and verify key through run, reconnect, Flag, fix, verification, and recurrence;
3. approves FixFlags in Claude Code and completes the same sequence;
4. installs/configures Cursor and completes the same sequence;
5. records missing, expired, cross-tenant, and insufficient-scope rejection evidence for the exact deployed SHA.

No product, account, key, deployment, or client configuration was changed.
