## What MCP does

MCP lets Codex, Claude Code, Cursor, Windsurf, and other compatible coding agents ask FixFlags to check software after a change. FixFlags executes the check through the same monitoring system used by Watch and the web product.

The coding agent may describe a commit, deployment, or affected area. That context helps identify the request, but it never counts as proof. FixFlags independently exercises the live Outcome.

## Connect

1. Sign in and open [Developer keys](/settings/api-keys).
2. Create a key for your client and copy the secret when it appears. It is shown once.
3. Open [MCP setup](/dashboard/mcp-setup) and add the configuration for your client.
4. Ask the client to list FixFlags Sites, then list Outcomes for the Site you own.

Keys inherit your account access. Free includes one Site and bounded verification; creating a key does not open access to another account's Sites.

## Tools

These are the tools FixFlags serves. The list is generated from the tool registry, so it always names tools that exist and never a tool that has been renamed.

<!-- generated:mcp-tools -->

Reading a Site, running its Outcomes, and reading the resulting Flags is the whole path. Recording a fix and verifying it are separate tools on purpose: FixFlags owns the verification, and a client cannot mark its own change Clear.

Checkout is the first first-class Outcome. Broad Site checks still run in FixFlags and remain visible under the Site board.

## Async runs

Verification is asynchronous. Start a run, keep the returned run ID, and poll that run until it completes or fails. A failed or blocked execution returns **Couldn't verify** rather than inventing a Flag. A completed result includes the Outcome state and a linkable Flag when one exists.

## Security and independence

- Every Site, Outcome, run, and Flag lookup is checked against the authenticated account.
- Developer keys are stored hashed, shown once, permission-scoped, time-bounded, and revocable. New keys default to read-only evidence for 90 days.
- FixFlags owns the browser execution and evidence. A caller cannot mark its own change Clear.
- Secrets, prompts, raw page content, and arbitrary URLs are not persisted as run context.
- Scheduled Watch continues without an MCP client connected.
