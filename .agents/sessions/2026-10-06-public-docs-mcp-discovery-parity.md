# Public Docs MCP discovery parity

**Task:** `public-docs-mcp-discovery-parity-2026-10-06`  
**Status:** locally verified; MCP remains undiscoverable; not deployed

## Failure found

The public `/docs` page rendered “MCP for coding agents” linking to
`/docs/mcp`. The edge correctly returned 404 for that withheld guide because
the three-client matrix is unproven. The existing visibility guard scanned
TypeScript copy and the Docs loader, but not `content/docs/index.md`, so it
allowed a customer-visible dead end.

## Repair

- The Docs index now uses `<!-- generated:mcp-guide-link -->`.
- The generated block emits the link only when `MCP_IS_DISCOVERABLE` is true,
  keeping route publication, navigation, search, and inline Docs discovery on
  one gate.
- The power-tool visibility guard now scans public Docs Markdown and exempts
  only the private MCP guide source that the edge withholds.
- A repository-level test runs the guard against the real source inventory, and
  a Docs test renders the actual index and compares the link to the gate.
- The affected verifier now selects `test:scripts` whenever a repository script
  changes, so future visibility-guard edits exercise their own contract tests.

## Evidence

- Power-tool visibility, copy-drift, focused Docs 8/8, guard 10/10, TypeScript,
  and scoped lint passed.
- The final 29-command repository manifest passed after the validation-routing
  change, including all guards, script/unit/coverage/accuracy suites, production
  web build, and worker bundle. Receipt:
  `.agent-runs/2026-10-06T22-56-36-013Z-worker-build.log`.
- A direct web-only Next server on port 3106 returned `/docs` as 200 with the
  Getting started, Site care, and Troubleshooting paths and no `/docs/mcp` or
  “MCP for coding agents” link.
- The same server returned `/docs/mcp` as 404 with no private guide body.

An initial attempt used the combined repository dev command. It ignored the
requested port, stopped the process on the default port, and briefly started the
worker, which claimed one existing local AI-review job and recorded a missing-
screenshot failure. Both processes were stopped immediately. The successful
proof used `npx next dev -p 3106`, which starts no worker. No production system,
customer account, MCP discovery gate, or deployment was changed.
