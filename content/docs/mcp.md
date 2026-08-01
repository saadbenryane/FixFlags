## How it works

FixFlags exposes a remote Model Context Protocol server. A connected editor discovers public FixFlags tools and can run the Product review → Fix → Update review workflow without leaving the editor.

## Endpoint and authentication

The production endpoint is `https://fixflags.com/api/mcp`. Clients authenticate with a FixFlags API key as a bearer token.

Create credentials only from the authenticated setup wizard. Public documentation always uses placeholders.

## Recommended workflow

1. Ask FixFlags to check the deployed URL and build a Finish Plan.
2. Inspect the highest-ranked Flag and its evidence.
3. Apply one focused fix in the current codebase.
4. Deploy the change.
5. Ask FixFlags to run an update review and compare against the original report.

See the [public tool reference](/docs/mcp/tools) for exact tool names.

## Connection testing

A connection is complete only when the client discovers every required public FixFlags tool. The setup wizard tests discovery and reports missing tools instead of treating a partial connection as success.

## Security

Keep API keys in the editor's supported secret store or environment. Never commit them, paste them into public URLs, or include them in analytics. Rotate a key from Settings if it may have been exposed.
