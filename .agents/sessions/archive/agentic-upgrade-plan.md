# FixFlags Agentic System Upgrade Plan

**Author**: CEO (FixFlags)
**Date**: 2026-08-10
**Status**: In Progress

---

## Executive Summary

The current agentic system has two disjoint layers:
1. **FixFlags Product Agents** — Audit pipeline, queue workers, MCP tools for check/re-check
2. **Pi-Web Fleet** — Session management, subagent spawning, crew orchestration

**Gap**: No autonomous loop connecting audit findings → fix implementation → verification → learning.

**Upgrade Goal**: Build a unified **Autonomous Fix Loop** that:
- Spawns fix crews from high-priority Flags
- Executes fixes with verification
- Runs re-checks to confirm resolution
- Captures learnings to improve future scans
- Operates within budget and founder attention constraints

---

## Current State Analysis

### FixFlags Product Layer (`/Users/saadbenryane/Code/fixflags/lib/audit/`)
- `runner.ts` → `pipeline/run-page.ts` → triage → prescription → finalize
- Queue: `lib/queue/worker.ts` with heartbeat + recovery
- MCP Tools: `ff_check_and_plan`, `ff_recheck_and_compare`, `ff_mark_fix_attempted`
- Skills: audit-pipeline, browser-capture, scan-accuracy, dogfood-accuracy

### Pi-Web Fleet Layer (`/Users/saadbenryane/.pi/agent/skills/`)
- `session-audit`, `session-boot`, `launch-subagent`, `fleet-briefs`
- Tools: `spawn_subagent`, `crew_dispatch`, `crew_steer`, `crew_reconcile`, `session_list`, `session_read`
- Company ops: CEO loop, worker profiles, heartbeat cadence

### Disconnects
| FixFlags Need | Pi-Web Capability | Gap |
|---------------|-------------------|-----|
| Auto-spawn fix crew from Flag | `spawn_subagent` (crewmate) | No trigger/integration |
| Verify fix with re-check | `ff_recheck_and_compare` MCP | No agentic loop |
| Learn from fix outcome | `.agents/learnings/` + skills | No capture pipeline |
| Fleet health monitoring | `session-audit` skill | Read-only, no auto-recovery |

---

## Upgrade Architecture

### 1. Autonomous Fix Loop Orchestrator (New)
**Location**: `lib/audit/fix-loop/orchestrator.ts`

```typescript
// Core loop (triggered by webhook or schedule)
interface FixLoopInput {
  reportId: string;
  flagIds: string[];           // High-priority flags to fix
  maxConcurrentFixes: number;  // Budget control
  autoDeploy: boolean;         // Requires founder approval if true
}

async function runFixLoop(input: FixLoopInput): Promise<FixLoopResult> {
  // 1. Fetch report + flags
  // 2. For each flag: spawn FIX_CREW with brief from flag.fixPrompt
  // 3. Wait for crew completion (with timeout)
  // 4. Run re-check on parent report
  // 5. Compare: Fixed / Remaining / New / Regressed
  // 6. Persist learning to .agents/learnings/fix-patterns/
  // 7. Update check accuracy corpus if deterministic
}
```

### 2. Fix Crew Brief Template (New)
**Location**: `.agents/skills/fixflags-fix-crew/SKILL.md`

- Role: CREWMATE (executes fix, no delegation)
- Input: Flag evidence + fix prompt + repo context
- Deliverable: PR/commit + verification commands run
- Escalation: AUTO-FIX (lint/typecheck/tests pass) / ASK CAPTAIN (design decisions) / NEVER AUTO (deploy)

### 3. Fleet Health Monitor (Upgrade `session-audit`)
**Location**: `.pi/agent/skills/session-audit/SKILL.md` + `lib/fleet/health-monitor.ts`

- Proactive stuck detection (3+ identical tool calls, >10min no progress)
- Auto-recovery: steer with trivial ping → if still stuck, archive + re-dispatch
- Metrics emission: `fleet_health` event for dashboard

### 4. Learning Capture Pipeline (New)
**Location**: `lib/audit/learning/capture.ts`

```typescript
interface FixLearning {
  flagId: string;
  checkId: string;           // Deterministic check that produced the flag
  fixPrompt: string;
  fixApproach: string;       // What the crew actually did
  verificationResult: 'passed' | 'failed' | 'partial';
  recheckResult: 'fixed' | 'remaining' | 'regressed' | 'new';
  timeToFix: number;         // Minutes
  modelUsed: string;
  tokensUsed: number;
}
```

- Feeds: accuracy corpus, prompt improvements, check refinements
- Triggers: `npm run accuracy:eval` regression gate

### 5. Unified Trigger System (New)
**Location**: `lib/audit/triggers/fix-loop-trigger.ts`

- Webhook: `POST /api/audit/{id}/fix-loop` (Studio only, gated)
- Schedule: Daily cron for Watch-enabled projects
- Manual: CLI `ff_fix_loop --report-id --flags=top3`

---

## Implementation Phases

### Phase 1: Foundation (Week 1) ✓ START HERE
- [ ] Create `lib/audit/fix-loop/` module structure
- [ ] Implement `FixCrewBrief` generator from Flag data
- [ ] Add `spawnFixCrew` wrapper using `spawn_subagent` tool
- [ ] Write `fixflags-fix-crew` skill with template
- [ ] Unit tests for brief generation

### Phase 2: Loop Execution (Week 1-2)
- [ ] Implement `runFixLoop` orchestrator
- [ ] Integrate with `ff_recheck_and_compare` MCP tool
- [ ] Add result comparison (Fixed/Remaining/New/Regressed)
- [ ] Handle timeouts, partial failures, retries
- [ ] Integration test with real Flag

### Phase 3: Learning & Observability (Week 2)
- [ ] Implement `captureFixLearning` persistence
- [ ] Upgrade `session-audit` with proactive health checks
- [ ] Add `fleet_health` metrics emission
- [ ] Connect learnings to accuracy corpus update

### Phase 4: Triggers & Polish (Week 2-3)
- [ ] Webhook endpoint for Studio auto-fix
- [ ] CLI command for manual trigger
- [ ] Schedule integration for Watch projects
- [ ] Dashboard: Fix Loop history + success rates
- [ ] Documentation + runbook

---

## Budget & Constraints

| Resource | Limit | Enforcement |
|----------|-------|-------------|
| Concurrent fix crews | 3 (configurable) | Orchestrator semaphore |
| Max fix time per flag | 15 min | Crew time-box + orchestrator timeout |
| Model cost per fix loop | $0.50 | Track via usage.ts, abort if exceeded |
| Founder approval | Required for auto-deploy | Gate in orchestrator |

---

## Success Metrics (Measurable)

1. **Fix Loop Completion Rate**: % of triggered loops that reach re-check comparison
2. **Flag Fix Rate**: % of targeted flags marked "Fixed" in re-check
3. **False Fix Rate**: % of "Fixed" flags that regress in subsequent scans
4. **Time to Fix**: Median minutes from trigger to re-check result
5. **Founder Attention**: Zero escalations for loops within budget
6. **Learning Velocity**: New accuracy corpus entries per month from fix loops

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Fix crews break unrelated code | Medium | High | Strict file allow-list in brief; git diff review gate |
| Re-check flakiness | Medium | Medium | Run re-check 2x, require consistent result |
| Model cost overrun | Low | High | Hard token budget per loop; free-model first |
| Stuck crews consuming fleet | Medium | Medium | Health monitor auto-archive + re-dispatch |
| Learning pollution (bad patterns) | Low | Medium | Human review gate before corpus injection |

---

## Next Actions

1. **Immediate**: Create `lib/audit/fix-loop/` + `FixCrewBrief` generator
2. **Today**: Write `fixflags-fix-crew` skill
3. **This Week**: End-to-end test with a real dogfood flag
4. **Next Week**: Learning capture + health monitor upgrade

---

## Canonical References

- `PRODUCT.md` — Shipped promise
- `knowledge/vision.md` — Signal→Understand→Prioritize→Fix→Verify→Learn
- `knowledge/report-contract.md` — Report hierarchy
- `docs/audit-pipeline.md` — Pipeline stages
- `.agents/company/ceo.md` — Operating loop
- `.agents/company/worker-profiles.md` — Crew roles
- `.agents/skills/fleet-briefs/SKILL.md` — Brief templates
- `.agents/skills/fixflags-audit-pipeline/SKILL.md` — Pipeline integration points