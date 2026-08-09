# Multi-Agent Coordination

## Overview

This directory enables safe parallel work by multiple AI agents (Cursor, Claude Code, Codex, Hermes, etc.). Read `AGENTS.md` (the canonical entry point) first, then consult this system before any substantial write task.

## Files and directories

| Path | Purpose |
|------|---------|
| `BOARD.md` | Active task board — claim here before starting |
| `GOAL.md` | Active goal state (gitignored): Condition, Proof, Constraints, turn Bound, Turn log with verdicts. Template: `GOAL.md.example`; detail briefs: `GOAL_BRIEF.md` (root) |
| `GOAL.md.example` | Committed template for goal-state tracking |
| `sessions/` | Implementation records for substantial work |
| `handoffs/` | Handoff documents for incomplete work between agents |
| `learnings/` | Validated project learnings (durable, not guesses). Active growth notes may live in `docs/growth/learnings.md` until promoted here. |
| `evals/` | Evaluation suites for quality verification |

## Rules

1. **Every substantial write task has a unique ID and owner.**
2. **Only one agent owns a write scope at a time.** Read-only research may run in parallel.
3. **Claim tasks on BOARD.md before starting.** Check for overlapping ownership. Record branch as `main`.
4. **Always work on `main` (pre-prod).** Do not create feature branches, `agent/*` branches, or git worktrees unless the user explicitly asks. Pull latest `main`, commit, and push to `main`.
5. **Never alter, reset, clean, stash, delete, switch, overwrite, discard, or force-push another agent's work on `main`.**
6. **Stop and document** ambiguous ownership or conflicting state.
7. **Create a handoff** before leaving meaningful work incomplete.
8. **Archive records** after useful knowledge is promoted into canonical docs, code, tests, or evals.
9. **After a BOARD task that changes product behavior or docs:** update the relevant `.cursor/skills/*/SKILL.md` in the same change set (see skill index under `.cursor/skills/`).

## Skills

Canonical skills live in `.cursor/skills/`. Prefer those over any mirrored copies under `.opencode/skills/` (deprecated mirrors; may lag).

| Skill | Use for |
|-------|---------|
| `fixflags-product-intelligence` | Vision, PI, Integrity Engine, Finish Plan, privacy/OSS |
| `fixflags-product` | Entitlements, billing, report UX, shipped loop |
| `fixflags-audit-pipeline` | Triage, prescription, recovery, browser observer |
| `fixflags-marketing` | Copy, GTM, positioning |
| `fixflags-completeness` | Doc drift, verify green |
| `fixflags-analytics` | Funnel events |
| `fixflags-design-system` | Design system, accessibility, responsive review, and polish |

Vision alignment: agents doing product strategy must read `knowledge/vision.md` and must not invent parallel narratives in skills.

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

Store durable, validated learnings under `.agents/learnings/`. Active growth notes may live in `docs/growth/learnings.md` until promoted here. Each entry must include: date, scope, confidence, evidence, discovery, why it matters, correct approach, where prevention was encoded.

Prefer permanent prevention (in order): tests → types → scripts → CI → canonical docs → AGENTS.md rules.

## Eval conventions

See `.agents/evals/README.md` for eval definitions.
