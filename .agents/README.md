---
status: supporting
authority: operations
reviewed_at: 2026-10-10
supersedes: []
---

# Agent coordination

Use coordination only when concurrent work could overlap. Routine read-only work and isolated edits need no lease or durable record.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run agent` | Compact repository and ownership status |
| `npm run agent -- context <area>` | Narrow authority map for an unfamiliar area |
| `npm run agent -- ownership` | Active leases and path conflicts |
| `npm run agent -- task claim ...` | Claim a potentially overlapping write scope |
| `npm run agent -- task heartbeat ...` | Extend an active lease |
| `npm run agent -- task finish ...` | Finish a lease |
| `npm run agent -- task release ...` | Release incomplete work |
| `npm run agent -- doctor` | Validate the coordination harness |

Live ownership is stored in the Git common directory. Archived task records are evidence, not startup context.

## Rules

- One writer owns an overlapping path at a time.
- Use a managed worktree for concurrent writers; one integration owner combines changes.
- Stop on an unresolved ownership conflict.
- Preserve unrelated working-tree changes.
- A lease coordinates work; it does not grant broader product or external authority.

## Durable records

Create a session or handoff only for a consequential decision, meaningful failure, cross-chat continuation, or evidence another person must use. Do not record routine completed work, raw transcripts, full logs, secrets, customer data, or source copies.

Historical files under `.agents/sessions/`, `.agents/handoffs/`, `.agents/history/`, and `.agents/learnings/` are never default instructions. Prefer prevention in code, tests, types, or canonical documentation over adding agent prose.
