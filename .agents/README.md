# Multi-Agent Coordination

## Overview

This directory enables safe parallel work by multiple AI agents (Cursor, Claude Code, Codex, Hermes, etc.). Read `AGENTS.md` (the canonical entry point) first, then consult this system before any substantial write task.

## Files and directories

| Path | Purpose |
|------|---------|
| `BOARD.md` | Active task board — claim here before starting |
| `sessions/` | Implementation records for substantial work |
| `handoffs/` | Handoff documents for incomplete work between agents |
| `learnings/` | Validated project learnings (durable, not guesses) |
| `evals/` | Evaluation suites for quality verification |

## Rules

1. **Every substantial write task has a unique ID and owner.**
2. **Only one agent owns a write scope at a time.** Read-only research may run in parallel.
3. **Claim tasks on BOARD.md before starting.** Check for overlapping ownership.
4. **Use isolated branches and worktrees** for concurrent write-heavy tasks:
   - Branch: `agent/<task-id>-<short-description>`
   - Worktree: `../qewos-<task-id>/`
5. **Never alter, reset, clean, stash, delete, switch, overwrite, or discard another agent's work.**
6. **Stop and document** ambiguous ownership or conflicting state.
7. **Create a handoff** before leaving meaningful work incomplete.
8. **Archive records** after useful knowledge is promoted into canonical docs, code, tests, or evals.

## Session conventions

Create session records only for:
- Substantial implementation
- Durable decisions
- Important discoveries
- Meaningful failures
- Incomplete work
- Architecture, schema, deployment, security, design, or soul changes

File: `.agents/sessions/<YYYY-MM-DD>-<task-id>-<agent>.md`

## Handoff conventions

Require a handoff whenever another agent must continue, review, integrate, or unblock incomplete work.

File: `.agents/handoffs/<task-id>.md`

## Learning conventions

Store durable, validated learnings under `.agents/learnings/`. Each must include: date, scope, confidence, evidence, discovery, why it matters, correct approach, where prevention was encoded.

Prefer permanent prevention (in order): tests → types → scripts → CI → canonical docs → AGENTS.md rules.

## Eval conventions

See `.agents/evals/README.md` for eval definitions.
