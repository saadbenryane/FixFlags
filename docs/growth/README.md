# Growth workspace

This directory is the permanent memory of FixFlags' organic growth system —
architecture, roadmap, decisions, experiments, and weekly reviews. It exists
so growth work compounds instead of resetting every time someone (human or
agent) picks it back up.

## Start here

1. **`vision.md`** — what we're building and why, in one page.
2. **`architecture.md`** — the four-layer design (Data Collection →
   Intelligence → Public Surfaces → Measurement & Feedback). Read this
   before touching `lib/graph/` or any `app/(marketing)/` page that
   claims to be data-driven.
3. **`roadmap.md`** — current phase and what's next.
4. **`growth-memory.md`** — the running log. Read the last 3 entries before
   starting new work; they tell you what was tried and what happened.

## The four-layer architecture

```
Layer 4: MEASUREMENT & FEEDBACK
  Attribution · Experiments · Weekly reviews · Learning
        ↓ feeds back into
Layer 3: PUBLIC SURFACES
  Issue pages · Benchmarks · Tools · Reports · Compare
        ↓ derived from
Layer 2: INTELLIGENCE
  Rollups · Opportunity scoring · Competitive analysis
        ↓ fed by
Layer 1: DATA COLLECTION
  Audit pipeline · GSC · Analytics · Backlinks · SERP
```

Each layer feeds the next. The loop closes when Layer 4 learning improves
what Layer 1 collects.

## Maintained files

| File | Purpose | Update cadence |
|---|---|---|
| `vision.md` | North star, scope, non-goals | Rarely — only on strategy pivots |
| `architecture.md` | Four-layer system design | When the architecture changes |
| `roadmap.md` | Phase plan, current focus | Weekly |
| `backlog.md` | Ranked opportunity ledger (P0-P4) | Weekly |
| `metrics.md` | KPI definitions + measurement framework | Weekly |
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
  assumption. See `architecture.md` § Information gain rule.
- **Minimum sample size gate.** No programmatic page ships below
  `MIN_SAMPLE_SIZE` (currently 20 distinct sites) for its scope. See
  `lib/graph/queries.ts`.
- **Attribution is mandatory.** Every public surface link to the audit
  flow must include UTM parameters. See `architecture.md` § Layer 4.
- **This is a repo-tracked workspace, not a wiki.** Changes here go through
  the same `main`-only workflow as the rest of the codebase (see root
  `AGENTS.md`).
