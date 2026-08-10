# Company Heartbeat Cadence (Canonical Contract)

Single source of truth for the FixFlags company heartbeat: tiers, what is
reported at each cadence, and how evidence is assembled. Primary readout:
`scripts/agent-heartbeat.mjs` (fixflags). For now, cadence orchestration is
operator-driven via manual or session-driven wake scripts; other files reference,
not duplicate.

## Why a heartbeat exists

The heartbeat is the company's idle pulse: it wakes one owner at a time only
when a cadence tier is due, feeds them deterministic evidence, and records the
wake so daily/weekly reviews and productivity trends are auditable. It is not
a busy-work loop. Most ticks are NO-OP.

## Cadence tiers (pre-launch default)

| Tier | Window | Purpose | Wakes |
|------|--------|---------|-------|
| `operational` | every 6 hours | Agent productivity pulse | Company session (least recently run first) |
| `daily` | every 24 hours | Review pulse: deltas, blockers, next step | Same |
| `weekly` | every 7 days | Founder-ready review: signals, objectives, pressure, decision need, owner | Same |

- The scheduler **poll loop** (`intervalMinutes`, default 60 pre-launch) checks
  dues; an agent is woken **only when a tier is due**. Fresh tiers = NO-OP tick.
- Weekly is the most overdue tier when multiple are due; then daily; then
  operational. One session per tick, one owner per next action.
- Post-launch the poll loop can tighten (10 min) and the same runtime supports
  server-ping/monitoring wakes; the tier windows stay configurable.
- Grace window (`graceMinutes`, default 60) skips sessions younger than the
  window (fresh spawns are not immediately woken).

## Config keys (`data/company-heartbeat.json`, gitignored)

```json
{
  "enabled": true,
  "intervalMinutes": 60,
  "graceMinutes": 60,
  "operationalHours": 6,
  "dailyHours": 24,
  "weeklyDays": 7
}
```

`enabled: false` stops scheduled ticks; `POST /api/company/heartbeat {force:true, kind}` still forces.

## What is reported at each tier

The runtime builds a **deterministic evidence packet** from providers, prepends
it to the wake prompt, and the agent replies with judgment only (signals,
decision need, owner). No fabricated metrics: every line names its source.

### Operational (every 6h) — the agent productivity pulse

- Board pulse: status counts; top blocked + queued items with owners.
- Fleet health: per company session (role/scope, streaming, status error flags,
  turns since last wake).
- Turns run per company session since its last wake (from session files).
- Board deltas since last wake: rows completed, newly blocked.
- Goal status + last logged turn.
- Next owner: one owner + action (from the readout).
- NO-OP rule: nothing meaningful → reply `noop`, no escalation.

### Daily (every 24h) — the review pulse

Everything in operational, plus:

- What changed since yesterday: completed rows, newly blocked rows, turns run
  per session.
- Objective progress one-liner (GOAL.md status) with evidence.
- Open decision needs / escalations (max 2, founder format when a decision is
  genuinely needed).
- One next step + single owner.

### Weekly (every 7d) — the founder review

Mirrors `customer-weekly-heartbeat.md` (customer scope) generalized:

- Company / project / week.
- Top 5 signals with proof links.
- Objective progress per objective: Blocked / At risk / On track + one-line evidence.
- Backlog pressure: queued count, blocked > 72h count, top 3 urgency blockers.
- Decision need: single question + recommendation + cost of waiting.
- Next action owner + deadline.
- Strategic scan status (ALIGNED / EVOLVE / DEFER / CONFLICT) when a directive was issued.
- NO-OP rule: no meaningful signal → only `**NO-OP**` + explicit `noop`.

## Deterministic evidence sources

| Signal | Source | Provider |
|--------|--------|----------|
| Board counts, blocked/queued, next owner | `.agents/BOARD.md` | `scripts/agent-heartbeat.mjs --json` (fixflags) |
| Goal status, condition, last turn | `.agents/GOAL.md` | same readout |
| Company session status/streaming | `data/subagents.json` (ceo/executive rows) | `companyRecords` |
| Turns since last wake per session | `~/.pi/agent/sessions/<cwd>/<ts>_<id>.jsonl` | `countTurnsSince` |
| Crew/subagent fleet counts | `data/subagents.json` (crewmate/secondmate/scout) | `readFleet` |

A provider that fails is reported **explicitly** (`board readout unavailable —
reason`), never silently omitted.

## Persistence & history

- **State file** `data/company-heartbeat-state.json`: per-session
  `lastRunAt`, `lastOperationalAt`, `lastDailyAt`, `lastWeeklyAt`, and the last
  board snapshot (for deltas). Written after every wake; survives restarts so
  cadence is real, not reset.
- **History log** `data/company-heartbeat-history.jsonl`: append-only,
  bounded (default 200 entries). One line per wake:
  `{ at, kind, sessionId, role, scope, forced, turns, prompt }`.

## Rules

- Deterministic checks before any LLM call; free models first.
- One owner per next action; ask less often.
- Every claim in a heartbeat names its check/source; no invented metrics.
- Learnings promoted to `.agents/learnings/` by the CEO; heartbeats never
  replace durable assets.
