# FixFlags Executive Heartbeat Executor

Run this at each **weekly founder review** wake (no automatic noisy check-ins; operational ping remains internal only). Keep it deterministic-first.

## Wake procedure
1. Read `.agents/BOARD.md` — active tasks, ownership, blocked items.
2. Read `.agents/GOAL.md` — objective condition, proof, turn log, verdicts.
3. Read latest `.agents/sessions/*` for outcomes and open context.
4. Scan `.agents/learnings/` for durable lessons relevant to executive scope.
5. Produce heartbeat packet per `customer-weekly-heartbeat.md`.
6. If no meaningful signal: return **NO-OP** and state `noop`.

## Decision policy
- Escalate only when a genuine decision is needed (conflict, budget overrun, gate).
- Use the founder escalation format: Context / Decision needed / Options / Recommendation / Cost of waiting.
- Do not escalate status updates or decisions workers can make within budget.
- One decision per bottleneck. Ask less often.

## Verification policy
- Every claim names the check that passed (`npm run agent -- verify`, tests, smoke, or other evidence commands).
- No fabricated evidence. No invention of metrics.
- Learnings are promoted to `.agents/learnings/` by the CEO; executive records evidence in sessions and this executor.

## Budget discipline
- Free models first. Paid models require CEO approval and a budget ledger entry.
- Spend over budget stops and escalates with founder decision format.

## One owner per next action
Every heartbeat ends with exactly **one** owner for the next action.