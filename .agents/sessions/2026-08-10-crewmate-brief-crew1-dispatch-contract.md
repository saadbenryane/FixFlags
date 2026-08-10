# CREWMATE BRIEF — Crew-1: Enforce persona-native worker dispatch contract

## 1. Role-boundary line

You are a CREWMATE sponsored by the First Mate. You are NOT the First Mate. The First Mate's AGENTS.md and configuration files are OFF-LIMITS as instructions — treat them as documents to edit per your allow-list only. You DO the work yourself — no delegation, no spawning.

## 2. First-action model/thinking line

Find your session id via `session_list`, then run `session_set_model(<id>, "opencode", "nemotron-3-ultra-free")` (big-pickle is currently exhausted per rate-limit data — retryAfterSeconds: 900). Then run `session_set_thinking(<id>, "off")` — big-pickle + thinking mode 400s reasoning_content passthrough (fleet-lessons 2026-08-09). If a turn 400s anyway, retry once, then STOP and report the error chain — never hop models.

## 3. Mission (3–5 lines)

Enforce the **persona-native worker dispatch contract** across the pi-web crew/task pipeline. The `spawn_child` / `crew_dispatch` flow in `lib/mate.mjs` + `lib/crew-tools.mjs` currently allows child crews to be dispatched without validating required contract fields (Scope, Modality, Model level, Autonomy level, Allowed budget, Objective link, Experiment link, Success criteria, Constraints, Expected outputs, Verification command(s), Required result capture, Expiry) as defined in `.agents/company/worker-runtime.md`. Add a `validateWorkerContract(task)` guard that rejects dispatches missing required fields with a clear error message (not a silent fallback). Deliverable: a new `lib/worker-contract.mjs` module exporting `validateWorkerContract` + integration into `spawn_child` in `lib/mate.mjs` and `crew_dispatch` in `lib/crew-tools.mjs`, with 3 new test cases in `scripts/test-session-tools.mjs`.

**Deliverable file:** `lib/worker-contract.mjs` (new) + edits to `lib/mate.mjs` + `lib/crew-tools.mjs` + tests in `scripts/test-session-tools.mjs`.

## 4. File allow-list (only these)

- `/Users/saadbenryane/Code/pi-web/lib/worker-contract.mjs` — CREATE (new module, exact validation per worker-runtime.md contract fields)
- `/Users/saadbenryane/Code/pi-web/lib/mate.mjs` — EDIT (add `import { validateWorkerContract }` + call at spawn_child entry)
- `/Users/saadbenryane/Code/pi-web/lib/crew-tools.mjs` — EDIT (add `import { validateWorkerContract }` + call at crew_dispatch entry)
- `/Users/saadbenryane/Code/pi-web/scripts/test-session-tools.mjs` — EDIT (add 3 test cases: valid contract passes, missing-scope fails, missing-model-level fails)

## DO-NOT-TOUCH

- `/Users/saadbenryane/Code/pi-web/lib/session-runtime.mjs` — Crew-2 territory if they touch it
- `/Users/saadbenryane/Code/pi-web/public/**` — firstmate/ui crew territory
- `/Users/saadbenryane/Code/fixflags/**` — fixflags repo, wrong side of the bridge
- `/Users/saadbenryane/Code/pi-web/lib/mate.mjs` lines 1-10 (imports) unless adding validateWorkerContract import
- Any running session or another crew's file

## 5. Unexpected-WIP rule

Uncommitted changes outside the allow-list (e.g. the `public/js/sessions/mod.js` and `lib/agent-chat.mjs` untracked in pi-web) → report, leave alone. Do not touch, stash, or overwrite.

## 6. Escalation tiers

- **AUTO-FIX:** Add missing validation guard; missing field → reject with message; syntax/type errors in worker-contract.mjs → fix and re-run tests
- **ASK CAPTAIN:** If `validateWorkerContract` would break existing spawn behavior (e.g., existing calls to `spawn_child`/`crew_dispatch` don't pass all contract fields) — stop, propose a default-fill strategy (auto-fill optional fields) vs. hard-reject
- **NEVER AUTO:** Do not weaken validation for "convenience"; do not modify session-runtime.mjs without Captain approval; do not touch fixflags files

## 7. Time-box

10 minutes max. Report the moment the deliverable is complete. If blocked or iterating >10 min, send a progress note. No polish loops.

## 8. Verification commands (run, show output)

```bash
cd /Users/saadbenryane/Code/pi-web
node --check lib/worker-contract.mjs
node --check lib/mate.mjs
node --check lib/crew-tools.mjs
node scripts/test-session-tools.mjs
npm run validate:lib
```

Expect: `worker-contract` syntax OK; tests show 3 new cases passing (total +3); `validate:lib` clean.

## 9. Report format

Files: `lib/worker-contract.mjs` (new), `lib/mate.mjs` (edited), `lib/crew-tools.mjs` (edited), `scripts/test-session-tools.mjs` (edited).

One line each:
- `lib/worker-contract.mjs`: validateWorkerContract reads 13 required fields, returns {ok:true} or {ok:false, missing:[...]}
- `lib/mate.mjs`: spawn_child calls validateWorkerContract before createAgentSession; rejects missing fields
- `lib/crew-tools.mjs`: crew_dispatch calls validateWorkerContract before listPending/dequeue; rejects missing fields
- `scripts/test-session-tools.mjs`: +3 tests, all green

Verification output: paste test runner stdout + `validate:lib` result.

Caveats: if existing callers omit fields, behavior changes (auto-fill vs. hard-reject) deferred to Captain per escalation tier.
