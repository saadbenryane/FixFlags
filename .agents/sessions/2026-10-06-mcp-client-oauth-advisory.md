# MCP OAuth client advisory repair

**Task:** `mcp-client-oauth-advisory-2026-10-06`  
**Status:** locally verified; not deployed

## Detection and exposure

The permanent dependency gate caught high-severity
`GHSA-6qxp-vccf-f47h` in `@modelcontextprotocol/client@2.1.0`. Affected OAuth
clients could send saved credentials to an authorization server selected by an
MCP server. GitHub lists `2.2.0` as the first patched 2.x client release.

FixFlags imports this package only in `lib/mcp/__tests__/sdk-lifecycle.test.ts`
with `InMemoryTransport`. It did not need to be a production dependency even
though the lockfile classified it that way.

## Repair and proof

- Moved `@modelcontextprotocol/client` to development dependencies and upgraded
  it to patched `2.3.1`; its nested core is `2.3.1` and both are marked dev-only
  in the lockfile.
- The real MCP SDK lifecycle test passed 1/1.
- `npm ls --omit=dev @modelcontextprotocol/client --all` returned an empty
  production graph.
- The permanent security gate passed with no moderate-or-higher runtime
  advisory and only the existing reviewed `braces` build chain.
- The final 30-command manifest passed, including a production image with 544
  pruned runtime packages and zero audit findings. A direct container probe
  confirmed `@modelcontextprotocol/client` is absent while
  `@modelcontextprotocol/core` and `@modelcontextprotocol/server` resolve.
  Container receipt:
  `.agent-runs/2026-10-06T22-45-47-632Z-container-build.log`.

No suppression, forced audit rewrite, credential rotation, client
authentication, push, or deployment occurred.
