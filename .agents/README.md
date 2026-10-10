---
status: supporting
authority: operations
reviewed_at: 2026-10-09
supersedes: []
---

# Agent coordination

Read the root [AGENTS.md](../AGENTS.md) first. This file describes coordination mechanics; it does not define product direction. The September 21 [vision](../knowledge/vision.md) is current.

## Compact control plane

| Command | Purpose |
| --- | --- |
| `npm run agent` | Bounded repository, ownership, and next-action summary |
| `npm run agent -- status` | Repository and current lease state |
| `npm run agent -- context <area>` | Small task-specific authority map |
| `npm run agent -- ownership` | Active leases and direct conflicts |
| `npm run agent -- task claim` | Claim a substantial write scope |
| `npm run agent -- task heartbeat` | Extend the current lease |
| `npm run agent -- task finish` | Finish ownership and record warranted history |
| `npm run agent -- task release` | Release incomplete or abandoned scope |
| `npm run agent -- doctor` | Validate harness and coordination health |
| `npm run agent -- verify --dry-run` | Preview proportional checks |

Use these commands instead of reading `.agents/BOARD.md`, archives, or every session.

## Ownership rules

1. A substantial write task has one owner and one non-overlapping scope.
2. One foreground writer may use the main checkout. Concurrent writers use separate managed worktrees.
3. Read-only research and review can share a checkout and do not require a write lease.
4. Live leases are shared through the repository's Git common directory, not a tracked branch file.
5. Heartbeat an active lease; expired leases warn and are never silently reassigned.
6. Reclaim an expired lease only with a recorded reason.
7. Stop on an unresolved path or scope conflict.
8. One integration owner combines concurrent work.
9. Never reset, clean, stash, overwrite, delete, or discard another worker's changes.

The former Markdown board is retained as migration history or a compatibility pointer. It is not live ownership state.

## Worktrees

Use a managed worktree when two writers could overlap in time. Do not create one for a trivial task with no concurrent writer; setup, dependency installation, and cold caches also have cost.

Before writing in a worktree, confirm its branch, ignored environment dependencies, install state, and lease. Before cleanup, preserve committed work and any needed ignored artifacts. Integration and archival remain the task owner's responsibility.

## Durable records

Create a session only for:

- a consequential decision or important validated discovery;
- meaningful failure or unresolved risk;
- work that must continue across chats;
- architecture, schema, deployment, security, or release evidence that future work needs.

File: `.agents/sessions/<YYYY-MM-DD>-<task-id>-<agent>.md`

Create a handoff only when another person or agent must continue, review, integrate, or unblock incomplete work.

File: `.agents/handoffs/<task-id>.md`

Routine fixes, read-only exploration, and completed local work do not require session or handoff documents. Do not copy raw transcripts, source, secrets, customer data, or full tool logs into records. Link to commits, tests, and canonical sources instead.

## Learnings and evaluations

Store only durable, validated discoveries in `.agents/learnings/`. Prefer prevention in this order: tests, types, scripts, CI, canonical docs, then agent instructions. Speculation and temporary progress do not qualify.

Evaluation definitions live in `.agents/evals/`. CI checks must be deterministic and must not invoke paid models. Model benchmarks are deliberate, human-triggered evaluations.

## Optional operating systems

`.agents/company/` and heartbeat/release-continuity workflows apply only when the user or active goal explicitly invokes that operating model. They are not startup requirements for normal repository work.

Project skill bodies live in `.agents/skills/`; other clients should use thin wrappers. Update a skill only when its trigger, durable workflow, or contract changes, not after every product or documentation edit.
