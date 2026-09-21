# FixFlags CLI

Connect MCP-compatible coding agents to FixFlags independent verification.

## Quick start

```bash
npx fixflags login
npx fixflags init
```

`fixflags init` installs the retained FixFlags skill and local MCP bridge without replacing existing editor configuration. It supports Codex, Claude Code, Cursor, and Windsurf. Browser login stores the credential in the operating-system credential store. For CI, set `FIXFLAGS_API_KEY`.

The normal agent loop is:

1. list an owned Site and its Outcomes;
2. request independent verification;
3. poll the returned run ID;
4. inspect a Flag and its evidence when the Outcome is broken;
5. make and deploy the fix;
6. ask FixFlags to verify the Flag again.

FixFlags runs the same monitoring engine used by the web product and scheduled Watch. The requesting agent can provide change context, but cannot declare its own result Clear.

## Direct commands

```bash
fixflags sites
fixflags outcomes <siteId>
fixflags verify-outcome <siteId> <outcomeId> --commit <sha>
fixflags run <runId>
fixflags flags <siteId>
fixflags flag <siteId> <flagId>
fixflags verify-flag <siteId> <flagId>
fixflags whoami
fixflags logout
```

Add `--json` for structured output. Verification is asynchronous: `verify-outcome` and `verify-flag` return a run ID, and `run` retrieves progress or the final result.

## MCP tools

- `ff_list_sites`
- `ff_list_outcomes`
- `ff_verify_outcome`
- `ff_get_run`
- `ff_list_flags`
- `ff_get_flag`
- `ff_verify_flag`

## Development

```bash
npm test
```

## Links

- [FixFlags](https://fixflags.com)
- [MCP guide](https://fixflags.com/docs/mcp)
- [Developer keys](https://fixflags.com/settings/api-keys)
