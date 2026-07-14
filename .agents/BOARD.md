# Task Board

*Active tasks. One owner per scope. Archive completed records.*

| Task ID | Status | Owner | Branch/worktree | Scope | Files/areas | Dependencies | Updated |
|---------|--------|-------|-----------------|-------|-------------|--------------|---------|
| merge-conflicts | done | auto | main | Merge origin/main into local main; resolve prompt-cache × flag-quality conflicts | lib/audit/judge-prescription.ts, lib/prompts/system-prompt.ts | — | 2026-07-14 |
| recheck-clarity | done | codex | main | Align core-loop and paid-value copy with Flag → Fix → Re-check | report actions/nav, pricing, marketing copy/tests | — | 2026-07-12 |
| report-quality-release | done | agent | main | Report quality + UX release plan | audit checks, report UI, gating | — | 2026-07-11 |

---

## Status definitions

- **proposed** — idea, not claimed
- **claimed** — owner assigned, work not started
- **in_progress** — active work
- **blocked** — waiting on dependency
- **review** — ready for review
- **done** — completed and verified
- **abandoned** — no longer relevant

## Rules

- Read this board before any substantial write task
- Claim tasks by adding a row before starting
- Update status, ownership, branch, and worktree as they change
- Archive completed records (move below the divider)
- The board does not replace Git, tests, PRs, or external trackers
