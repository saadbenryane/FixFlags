# Agent Operating System

Read `AGENTS.md` first — it is the canonical entry point for all AI agents.

## Git rules

Always work directly on `main`. Do not create feature branches or worktrees unless the user explicitly asks. Pull, commit, and push on `main`.

## Coordination

Before any substantial write task, read `.agents/BOARD.md` to check for overlapping ownership and claim your task. Preserve all existing working-tree changes. Never reset, clean, stash, overwrite, or discard another task's work.

## Skill loading

Skills in `.agents/skills/` and `.cursor/skills/` are loadable via the `skill` tool. Load the relevant skill before starting work in an area.

## Token efficiency

- Strip tool output to signal before it enters context. A passing test suite returns "PASS", not 800 lines.
- Decompose complex tasks into subagents with fresh, isolated contexts. One task, one fresh agent.
- Prefer skeletons (signatures/types/exports) before full file reads when exploring modules.
- Keep AGENTS.md and skill content stable across turns for prompt-cache reuse.
