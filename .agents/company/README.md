# FixFlags AI Operating Model (Company Policy)

Canonical index for the AI-native operating model. All policy lives here; other files reference, not duplicate.

## File map

| File | Scope |
|------|-------|
| `ceo.md` | CEO strategy, operating loop, **asset-first creation**, **active objectives schema**, **budget ledger**, **model routing**, **modality-aware routing**, **autonomy budget**, **rhythm (event wakes, heartbeat, daily/weekly review)**, **experiment protocol with termination states**, **release gates**, **founder escalation format**, **lean scorecard**, **dogfooding loop and autonomy metrics**, **external actions governance** |
| `executives.md` | Executive ownership boundaries + **objective setting/review cadence**, **paid model approvals**, **external action compliance review** |
| `worker-runtime.md` | Temporary worker contract + **task contract fields** (scope, modality, model level, autonomy level, allowed budget, objective link, experiment link, required result capture) |

## Policy sections

| Policy | Location |
|--------|----------|
| Experiment termination states: adopt / iterate / reject / inconclusive | `ceo.md` → Experiment protocol |
| Learning reinjection into durable docs | `ceo.md` → Experiment protocol |
| Release gates PASS / Continue, FIX, DECIDE + required checks | `ceo.md` → Release gates |
| Founder-facing escalation format and anti-patterns | `ceo.md` → Founder escalation |
| Model routing, modality routing, autonomy budget | `ceo.md` → Routing and rhythm |
| Rhythm: event-driven wakes + 30-60 minute heartbeat + daily/weekly review | `ceo.md` → Routing and rhythm |
| Lean scorecard (Business / Product / Autonomy) incl. useful output per unit of founder attention | `ceo.md` → Lean scorecard |
| Dogfooding loop and autonomy metrics | `ceo.md` → Dogfooding |
| External action governance | `ceo.md` → External actions |
| Executive paid-model approvals, objective and review cadence | `executives.md` |
| Worker task contract fields | `worker-runtime.md` |

## Docs policy

- Single source of truth: this directory. No competing routing systems, no parallel policy files.
- Free-first model policy is mandatory; paid models require explicit justification (see `executives.md`).
- Objectives (1-3 max) drive execution cadence; experiments follow the protocol in `ceo.md`.
- External actions go through capability-first secure connectors; raw credentials are forbidden.
- Autonomy levels (1/2/3) are editable policy, not hardcoded constants.
- Budget ledger tracks AI/model, infra, marketing spend against revenue and gross margin targets.
- Workers receive task contracts with all fields defined in `worker-runtime.md`.

## Canonical integration

- `.agents/README.md` points to this file as the operating model anchor.
- `.agents/BOARD.md` records active task scope.
- `.agents/GOAL.md` references the operating-state loop for executive work.
- `knowledge/README.md` cross-references the agent operating model as canonical process.

Keep this directory minimal and practical; avoid duplicating policy in unrelated files.
