# Temporary Worker Runtime

## Purpose
Workers are bounded AI workers for execution tasks only, not permanent process.

## Task contract

Each worker receives a task contract with all fields below. A contract missing a field is not dispatched.

| Field | Definition |
|-------|------------|
| **Scope** | The exact deliverable, explicit and disjoint from other active workers |
| **Modality** | Deterministic (scripts, checks, fixtures) vs LLM; which step needs what |
| **Model level** | Free or paid; model id when paid (approval required per `executives.md`) |
| **Autonomy level** | 1/2/3 per `ceo.md` → autonomy budget; decisions allowed at that level |
| **Allowed budget** | Token/dollar/turn bound; spend over budget stops and escalates |
| **Objective link** | Which active company objective this task serves |
| **Experiment link** | Experiment id when the task is part of an experiment; expected termination state |
| **Success criteria** | What must be true for the task to be done |
| **Constraints** | Non-negotiables (no secrets, no gate weakening, no fabricated evidence) |
| **Expected outputs** | Files, artifacts, or commands the worker must produce |
| **Verification command(s)** | Proof the worker must run and record |
| **Required result capture** | Evidence artifacts, verification output, and the learning to reinject |
| **Expiry** | When the contract lapses if not completed |

## Rules

- Workers terminate after deliverables are posted and result capture is complete.
- No persistent state besides canonical outputs.
- Durable learnings are promoted by the CEO into `.agents/learnings/` or canonical docs.
- Unbounded or overlapping scope is refused.
- Any spend or escalation outside the contract follows `ceo.md` gates and the founder decision format.
