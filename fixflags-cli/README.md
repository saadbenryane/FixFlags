# FixFlags CLI

Connect MCP-compatible coding agents to FixFlags independent verification.

## Quick start

```bash
npx fixflags login
npx fixflags init
```

`fixflags init` installs the retained FixFlags skill and local MCP bridge without replacing existing editor configuration. It supports Codex, Claude Code, Cursor, and Windsurf. Browser login stores the credential in the operating-system credential store. For CI, set `FIXFLAGS_API_KEY`.

The generated editor configuration launches the same immutable CLI version through `npx`, so the documented `npx fixflags init` flow does not require a separate global install and cannot silently move to a newer package version.

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
fixflags record-fix <siteId> <flagId> "Describe the deployed change"
fixflags verify-flag <siteId> <flagId> <attemptId>
fixflags whoami
fixflags logout
```

Add `--json` for structured output. Verification is asynchronous: `verify-outcome` and `verify-flag` return a run ID, and `run` retrieves progress or the final result.

## MCP tools

- `fixflags.list_sites`
- `fixflags.list_outcomes`
- `fixflags.run`
- `fixflags.get_run`
- `fixflags.list_flags`
- `fixflags.get_flag`
- `fixflags.record_fix`
- `fixflags.verify_flag`
- `fixflags.get_connection_info`

## Development

```bash
npm test
```

## Links

- [FixFlags](https://fixflags.com)
- [MCP guide](https://fixflags.com/docs/mcp)
- [Developer keys](https://fixflags.com/settings/api-keys)
