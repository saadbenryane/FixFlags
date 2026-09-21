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

- `ff_list_sites` finds the Sites owned by the connected account.
- `ff_list_outcomes` shows what FixFlags is responsible for watching on one Site.
- `ff_verify_outcome` starts an independent verification and returns a run ID.
- `ff_get_run` returns progress and the final Clear, Flag, or Couldn't verify result.
- `ff_list_flags` and `ff_get_flag` return active incidents and their evidence.
- `ff_verify_flag` starts a comparable re-verification after a fix.

Checkout is the first first-class Outcome. Broad Site checks still run in FixFlags and remain visible under the Site board.

## Async runs

Verification is asynchronous. Start a run, keep the returned run ID, and poll `ff_get_run` until it completes or fails. A failed or blocked execution returns **Couldn't verify** rather than inventing a Flag. A completed result includes the Outcome state and a linkable Flag when one exists.

## Security and independence

- Every Site, Outcome, run, and Flag lookup is checked against the authenticated account.
- API keys are stored hashed and can be revoked at any time.
- FixFlags owns the browser execution and evidence. A caller cannot mark its own change Clear.
- Secrets, prompts, raw page content, and arbitrary URLs are not persisted as run context.
- Scheduled Watch continues without an MCP client connected.
