# Temporary Worker Profiles (Deployable in First Mile)

Use this as the pre-defined profile pack for FixFlags executive dispatches.

## 1) Runtime Continuity Worker

**Purpose:** unblock local/runtime continuity and release-readiness blockers.

- **Typical scope:** local startup, web/worker handoff checks, container readiness, health route smoke, queue stability, context leak prevention.
- **Preferred modality:** deterministic first (`scripts/runtime-start.mjs`, `docker-compose`, `scripts/release-smoke.mjs`, `scripts/doctor.mjs`, `scripts/test`), then limited LLM for root-cause framing.
- **Deliverable:** one concise report with exact failing checks and minimal next owner action.
- **Verification:** `npm run doctor`, `npm run smoke:release`, targeted service-level checks (`/api/health`, `/api/health/ready`, `/api/health/worker`), and queue heartbeat evidence.

Suggested contract fields:
- Scope: `runtime continuity`
- Modality: `deterministic`
- Model level: `free`
- Autonomy: `2`
- Result capture: command outputs + artifact path + evidence to `.agents/learnings/` or `.agents/sessions/`

## 2) CLI/MCP Continuity Worker

**Purpose:** align local CLI + MCP + cloud handoff continuity.

- **Typical scope:** `fixflags-cli`, MCP command quality, editor init flows, API key and transport trust, CLI package/release blocking risks.
- **Preferred modality:** deterministic for contracts/interfaces, LLM only for mismatch diagnosis and minimal patch plan.
- **Deliverable:** clear gap matrix: shipped vs target + minimal deltas to restore continuity.
- **Verification:** `npm run cli:status`, `npm run cli:registry-guard`, `npm run mcp:quality-gate`, `scripts/fixflags-cli-status.mjs`.

Suggested contract fields:
- Scope: `cli-mcp continuity`
- Modality: `deterministic`
- Model level: `free`
- Autonomy: `2`
- Result capture: test evidence + command logs + concrete unblock steps.

## 3) Backlog Pressure & Objective Worker

**Purpose:** reduce operating entropy from board/goal drift.

- **Typical scope:** parse `.agents/BOARD.md` + `.agents/GOAL.md`, identify backlog pressure, recommend one owner for next action.
- **Preferred modality:** deterministic with lightweight summarization.
- **Deliverable:** one-line executive signal with owner and rationale.
- **Verification:** board parse success, objective status extraction, next-action recommendation reproducibility.

Suggested contract fields:
- Scope: `backlog pressure`
- Modality: `deterministic`
- Model level: `free`
- Autonomy: `2`
- Result capture: heartbeat artifact + recommendation in `.agents/sessions/`.

## 4) FixFlags Executive Signal Monitor

**Purpose:** surface recurring external/internal signals and rank what matters most to current objectives.

- **Typical scope:** support queue sentiment, issue clustering, false-positive and defect patterns, growth or retention friction signals.
- **Preferred modality:** deterministic extraction from `.agents/BOARD.md`, logs, and support/review artifacts, then concise synthesis.
- **Deliverable:** one compact signal memo with 5 top signals and evidence links.
- **Verification:** evidence-first pointers that exist in tracked files; no synthetic counts.

Suggested contract fields:
- Scope: `exec-signal-monitor`
- Modality: `deterministic`
- Model level: `free`
- Autonomy: `2`
- Result capture: heartbeat section + session log with signal IDs and proof links.

## 5) FixFlags Backlog Prioritizer

**Purpose:** convert board/goal state into the next owner action with lowest-friction sequence.

- **Typical scope:** identify blocked/queued pressure, objective gaps, sequencing conflicts.
- **Preferred modality:** deterministic parse + limited reasoning for trade-offs.
- **Deliverable:** ranked backlog list and one recommended next action owner.
- **Verification:** reproducible parse + one owner recommendation with rationale.

Suggested contract fields:
- Scope: `exec-backlog-prioritize`
- Modality: `deterministic`
- Model level: `free`
- Autonomy: `2`
- Result capture: `.agents/sessions/` + `.agents/BOARD.md` delta notes.

## 6) FixFlags Escalation Steward

**Purpose:** prepare founder-facing escalation packets with one decision and clear option set.

- **Typical scope:** objective/constraint conflict, budget pressure, gate ambiguity, external action dependency.
- **Preferred modality:** deterministic evidence assembly, high-signal decision framing.
- **Deliverable:** one decision packet with 2-4 options, recommendation, and cost-of-waiting.
- **Verification:** includes required fields from founder escalation format and evidence links.

Suggested contract fields:
- Scope: `exec-escalation`
- Modality: `deterministic`
- Model level: `free`
- Autonomy: `3`
- Result capture: decision packet in `.agents/sessions/` and evidence list.

## 7) Executive Judgment Guard

**Purpose:** prevent release/blocker judgments without evidence.

- **Typical scope:** release-readiness executive calls, weekly heartbeat summaries, and blocked/queued prioritization statements.
- **Preferred modality:** deterministic.
- **Deliverable:** one compact proof packet with:
  - heartbeat JSON source or `npm run agent:heartbeat -- --json` output
  - owner-referenced blocker details from `.agents/BOARD.md`
  - linked `.agents/sessions/*` evidence artifact.
- **Verification:** all claims are evidence-linked and tied to an owner with one next action.

Suggested contract fields:
- Scope: `exec-judgment`
- Modality: `deterministic`
- Model level: `free`
- Autonomy: `2`
- Result capture: session artifact + evidence references in `.agents/sessions/`.

## Hardening rules

No launch or blocker judgment is made before a spawned worker posts evidence in `.agents/sessions/`.
Board scan must verify queued and blocked IDs with owners before any queue status classification.
Every output tag includes its evidence source before a judgment is rendered.
Chat-only decisions are forbidden; meaningful conclusions are filed in `.agents/sessions/*`.
