# CLI keychain credentials require a local MCP bridge

## Finding

An editor HTTP MCP configuration cannot read a token stored in the operating
system credential store. Pointing the editor directly at `/api/mcp` therefore
forces either a project-file secret or a second manual authentication flow.

## Prevention

For installed local editors, configure a stdio MCP command (`fixflags mcp`).
The CLI reads the keychain credential, forwards JSON-RPC to the canonical remote
MCP endpoint, and returns the unchanged response. Keep cloud editors on their
own managed connector secret stores.

## Evidence

`fixflags-cli/test/cli.test.mjs` verifies the bridge sends authenticated MCP
requests without printing the credential. `fixflags-cli/test/auth-init.test.mjs`
verifies generated editor configuration contains the bridge command and no
FixFlags secret.
