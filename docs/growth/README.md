# Growth workspace

This directory is the permanent memory of FixFlags' organic growth system —
architecture, roadmap, decisions, experiments, and weekly reviews. It exists
so growth work compounds instead of resetting every time someone (human or
agent) picks it back up.

## Start here

1. **`vision.md`** — what we're building and why, in one page.
2. **`architecture.md`** — the knowledge-graph + public-surface design. Read
   this before touching `lib/graph/` or any `app/(marketing)/` page that
   claims to be data-driven.
3. **`roadmap.md`** — current phase and what's next.
4. **`growth-memory.md`** — the running log. Read the last 3 entries before
   starting new work; they tell you what was tried and what happened.

## Maintained files

| File | Purpose | Update cadence |
|---|---|---|
| `vision.md` | North star, scope, non-goals | Rarely — only on strategy pivots |
| `architecture.md` | System design (graph + public layer) | When the architecture changes |
| `roadmap.md` | Phase plan, current focus | Weekly |
| `backlog.md` | Ranked opportunity ledger | Weekly |
| `metrics.md` | KPI definitions + current values | Weekly |
| `experiments.md` | Hypothesis → outcome log | Per experiment |
| `learnings.md` | What worked / didn't, dated | Per iteration |
| `opportunities.md` | GSC/analytics-derived opportunities | Weekly |
| `competitors.md` | Who ranks, their moats, our wedges | Monthly |
| `growth-memory.md` | Append-only weekly digest (the brain) | Weekly |
| `decision-log.md` | Major decisions with review dates | Per decision |
| `weekly-review/` | Per-week detail files | Weekly |

## Rules

- **Never delete accumulated knowledge.** Consolidate, don't erase. If an
  entry in `growth-memory.md` is superseded, note the supersession — don't
  remove the original.
- **Every public page must trace to data.** If a page claims a statistic,
  the number must come from `lib/graph/queries.ts`, not from memory or
  assumption. See `architecture.md` § Information Gain.
- **Minimum sample size gate.** No programmatic page ships below
  `MIN_SAMPLE_SIZE` (currently 20 distinct sites) for its scope. See
  `lib/graph/queries.ts`.
- **This is a repo-tracked workspace, not a wiki.** Changes here go through
  the same `main`-only workflow as the rest of the codebase (see root
  `AGENTS.md`).
