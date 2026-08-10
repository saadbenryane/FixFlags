# FixFlags Executive Operating System Upgrade

## Scope
Upgrade the FixFlags executive layer so the CEO can delegate bounded workers, reuse stable memory, and receive a weekly evidence heartbeat that is immediately actionable.

This document is canonical for FixFlags executive worker dispatch and reporting in this project.

## FixFlags executive memory stack (required)
Use only canonical files; never rely on chat memory.

- **Signals & board state:** `.agents/BOARD.md`
- **Objective state:** `.agents/GOAL.md`
- **Cross-project context:** `knowledge/README.md`
- **Session outcome logs:** `.agents/sessions/<YYYY-MM-DD>-<task-id>-<agent>.md`
- **Durable learnings:** `.agents/learnings/`

## Worker personas (FixFlags executive)

Cross-reference: shared worker contract fields and cross-domain profiles live in `worker-profiles.md`; this file adds FixFlags executive personas. One concept, one canonical source — no duplication.

One worker per narrow scope. All three default to free models and autonomy level 2 unless CEO approves otherwise.

### Persona A: FixFlags Signal Monitor
- Role: collect and summarize product/customer signals, support patterns, and workflow friction.
- Scope: support/chat log review, issue trends, false-positive/defect complaint grouping.
- Modality: deterministic-first; LLM only for synthesis.
- Allowed budget: 2,500 tokens or 1 hour wall time.
- Success criteria: triaged signal packet + top 3 recurring issues + evidence links.

### Persona B: FixFlags Backlog Prioritizer
- Role: convert signals into queue priorities tied to objectives and backlog pressure.
- Scope: objective vs backlog alignment, objective progress gaps, blocked items.
- Modality: deterministic checks (BOARD, GOAL, objective artifacts) + concise LLM judgement.
- Allowed budget: 3,000 tokens or 1 hour wall time.
- Success criteria: ranked backlog action list with estimated delay cost.

### Persona C: FixFlags Escalation Steward
- Role: draft founder-ready escalation summaries when decisions are needed.
- Scope: escalate conflicts between objective, backlog pressure, and evidence.
- Modality: deterministic evidence assembly + high-clarity decision framing.
- Autonomy: level 3 with explicit decision proposal and option set.
- Allowed budget: 1,500 tokens or 30 minutes wall time.
- Success criteria: escalation packet with one clear decision question and 2-4 options.

## Spawn contract template
Scope, Modality, Autonomy level, Allowed budget, Objective link, Experiment link, Success criteria, Constraints, Expected outputs, Verification command(s), Required result capture, Expiry. Omitted field blocks dispatch (per `worker-runtime.md`).

## Weekly heartbeat packet (FixFlags executive)
Template for CEO-ready weekly review:

- **Signal:** 5 strongest product/market signals with proof links.
- **Objective progress:** one line per objective; status = Blocked / At risk / On track.
- **Backlog pressure:** queued count, items blocked > 72h, top 3 urgency blockers.
- **Decision need:** single recommendation and impact of waiting.

Use concise language; evidence links over prose. No invented metrics.