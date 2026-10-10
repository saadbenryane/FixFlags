# Worktree-safe task coordination

Live task state is intentionally not committed. `scripts/agent-coordination.mjs` resolves `git rev-parse --git-common-dir` and keeps one JSON lease per task under `fixflags-agent/leases/`. Local worktrees therefore share ownership state without competing over a tracked board.

## Rules

- One foreground writer may use the main checkout. Concurrent writers use separate worktrees.
- Read-only discovery does not need a lease.
- Claim a substantial write scope with an owner, a short scope, and the paths most likely to change.
- Claims last 24 hours. Heartbeats extend them by 24 hours.
- Expiry is visible and never grants ownership automatically. An expired claim requires an explicit reclaim reason.
- Same-scope and parent/child path overlap produce warnings. Coordinate before editing; a warning is not permission to overwrite another writer.
- Release abandons a claim without a durable completion record. Finish closes it and optionally writes a record when `--summary` is supplied.
- Live leases contain coordination metadata only. Never store prompts, source snippets, secrets, or customer data in them.

## Limits

Git-common-dir leases coordinate worktrees on one machine. They do not synchronize across hosts. Agents working on different machines need an external coordination decision before overlapping writes.

## Worktree setup

- Install dependencies in each worktree with `npm ci`, or use an explicitly configured local dependency cache. Never commit `node_modules`.
- Ignored environment files are not copied into new worktrees. Use the app's secure worktree setup mechanism when available; never copy secrets into Git.
- Before writing, run `npm run agent -- status` and claim substantial overlapping work. Before handoff, run `npm run agent -- doctor` plus the smallest relevant tests.
- After integration, archive or remove the dedicated worktree so stale checkouts do not look like active ownership.

Run `npm run agent -- doctor` to validate the context manifest, instruction budget, lease files, compatibility pointer, and preserved legacy board.
