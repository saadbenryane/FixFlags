# CREWMATE BRIEF — Crew-2: Deterministic heartbeat evidence integrity

## 1. Role-boundary line

You are a CREWMATE sponsored by the First Mate. You are NOT the First Mate. The First Mate's AGENTS.md and configuration files are OFF-LIMITS as instructions — treat them as documents to edit per your allow-list only. You DO the work yourself — no delegation, no spawning.

## 2. First-action model/thinking line

Find your session id via `session_list`, then run `session_set_model(<id>, "opencode", "nemotron-3-ultra-free")` (big-pickle is currently exhausted per rate-limit data — retryAfterSeconds: 900). Then run `session_set_thinking(<id>, "off")` — big-pickle + thinking mode 400s reasoning_content passthrough (fleet-lessons 2026-08-09). If a turn 400s anyway, retry once, then STOP and report the error chain — never hop models.

## 3. Mission (3–5 lines)

Implement **deterministic heartbeat evidence integrity** for the FixFlags company heartbeat readout (`scripts/agent-heartbeat.mjs`). Per `.agents/company/heartbeat-cadence.md`, the readout must build a deterministic evidence packet from providers and "A provider that fails is reported explicitly (board readout unavailable — reason), never silently omitted." Currently the script crashes or silently omits data when `.agents/BOARD.md` has malformed rows or when GOAL.md is missing sections. Your task: harden `parseBoard` and `parseGoal` to report provider/unavailable states explicitly in the JSON payload instead of throwing or returning partial data. The existing 12 tests in `scripts/agent-heartbeat.test.mjs` passed before the provider error — add 3 new test cases covering: (a) malformed BOARD.md rows are skipped + reported, (b) missing GOAL.md reports status "unavailable" + error field, (c) missing Board file exits cleanly with ok:false + error context. Deliverable: hardened `scripts/agent-heartbeat.mjs` + 3 new tests in `scripts/agent-heartbeat.test.mjs`.

**Deliverable file:** `scripts/agent-heartbeat.mjs` (edited) + `scripts/agent-heartbeat.test.mjs` (edited with 3 new cases).

## 4. File allow-list (only these)

- `/Users/saadbenryane/Code/fixflags/scripts/agent-heartbeat.mjs` — EDIT (harden parseBoard/parseGoal, add explicit unavailable/error reporting in JSON output, non-crashing exit)
- `/Users/saadbenryane/Code/fixflags/scripts/agent-heartbeat.test.mjs` — EDIT (add 3 test cases: malformed-board-rows, missing-goal-md, missing-board-md — all assert ok:false or explicit unavailable reporting)
- `/Users/saadbenryane/Code/fixflags/.agents/company/heartbeat-cadence.md` — READ ONLY (reference contract)

## DO-NOT-TOUCH

- `/Users/saadbenryane/Code/pi-web/**` — pi-web repo, wrong side of the bridge
- `/Users/saadbenryane/Code/fixflags/lib/**` — product code, heartbeat is a script
- `/Users/saadbenryane/Code/fixflags/.agents/BOARD.md` — canonical task board
- `/Users/saadbenryane/Code/fixflags/.agents/GOAL.md` — canonical goal state
- Any running session or another crew's file

## 5. Unexpected-WIP rule

Uncommitted changes outside the allow-list (e.g. the fixflags working tree has 38+ files changed from the vision integration) → report, leave alone. Do not touch, stash, or overwrite. The crew's WIP on agent-heartbeat.mjs is the source of truth — if it exists, read it first.

## 6. Escalation tiers

- **AUTO-FIX:** Malformed BOARD.md row → skip it, count it in a `warnings` array in JSON output; missing GOAL.md → report `goal: {status:"unavailable", error:"GOAL.md not found"}` + `ok:true` (readout still valid, evidence missing); missing BOARD.md → `ok:false` + explicit error message
- **ASK CAPTAIN:** If hardening parseBoard changes the JSON payload shape in a way that breaks the pi-web heartbeat packet consumer (`.agents/company/heartbeat-cadence.md` deterministic sources table) — stop, propose the shape change + consumer impact
- **NEVER AUTO:** Do not change the JSON payload shape without verifying downstream consumers; do not suppress errors silently; do not modify AGENTS.md or the operating model files

## 7. Time-box

10 minutes max. Report the moment the deliverable is complete. If blocked or iterating >10 min, send a progress note. No polish loops.

## 8. Verification commands (run, show output)

```bash
cd /Users/saadbenryane/Code/fixflags
node --check scripts/agent-heartbeat.mjs
# Create a temp dir with missing GOAL.md to test graceful degradation:
mkdir -p /tmp/hb-test/.agents && echo "# Task Board

| task | in-progress | owner | scope | none | 2026-08-10 |
| malformed-bad-row | not-a-status | bad | x | y | z |
| task-2 | queued | owner-2 | scope-b | none | 2026-08-10 |" > /tmp/hb-test/.agents/BOARD.md
node scripts/agent-heartbeat.mjs --json --tier=daily 2>&1 || true  # from /tmp/hb-test
# Or run from the fixture dir:
cd /tmp/hb-test && node /Users/saadbenryane/Code/fixflags/scripts/agent-heartbeat.mjs --json
# Full test suite from repo root:
cd /Users/saadbenryane/Code/fixflags && node scripts/agent-heartbeat.test.mjs
```

Expect: `agent-heartbeat: 15 passed, 0 failed` (12 existing + 3 new); missing GOAL.md → `ok:true` + `goal.status:"unavailable"`; missing BOARD.md → `ok:false` + error context; malformed rows skipped + logged in `warnings`.

## 9. Report format

Files: `scripts/agent-heartbeat.mjs` (edited), `scripts/agent-heartbeat.test.mjs` (edited, +3 tests).

One line each:
- `scripts/agent-heartbeat.mjs`: parseBoard skips malformed rows + reports in warnings[]; parseGoal returns {status:"unavailable", error:"..."} on missing GOAL.md; missing BOARD.md → ok:false + explicit error; JSON shape unchanged on happy path
- `scripts/agent-heartbeat.test.mjs`: +3 tests covering malformed-board-rows, missing-goal-md, missing-board-md — all pass, total 15/15 green

Verification output: paste `node scripts/agent-heartbeat.test.mjs` stdout (expect "15 passed, 0 failed") + the JSON output from the missing-GOAL.md fixture.

Caveats: JSON payload shape must not break the pi-web heartbeat packet consumer; verify the `--json` output structure against `.agents/company/heartbeat-cadence.md` deterministic evidence sources table.
