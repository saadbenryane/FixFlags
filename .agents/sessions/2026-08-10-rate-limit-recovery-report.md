# Rate-Limit Recovery Report — 2026-08-10

## Status snapshot

- **Now:** 2026-08-10 12:33 UTC
- **big-pickle resets in:** ~9 min (retryAfterSeconds: 900, resetAt: 1786365747094)
- **Backlog:** empty (0 pending tasks)
- **Core modules:** lib/mate.mjs, lib/crew-tools.mjs, lib/session-runtime.mjs — all pass `node --check` ✅ (no syntax corruption)

## Erroring sessions mapped

| Session | Title | Repo | CWD | Error | Parent |
|---------|-------|------|-----|-------|--------|
| `0b77b3b5` | Objective1: persona-native worker dispatch contract | pi-web | `/Users/saadbenryane/Code/pi-web` | `Provider finish_reason: error` | `9824fe5b` |
| `a306e9ba` | Objective2: deterministic heartbeat evidence integrity | fixflags | `/Users/saadbenryane/Code/fixflags` | `Provider finish_reason: error` | `9824fe5b` |
| `9824fe5b` | FixFlags system upgrade (parent secondmate) | pi-web | pi-web | `429: FreeUsageLimitError` | First Mate |

## Root cause diagnosis

**Primary cause: big-pickle + thinking-mode = 400 reasoning_content passthrough error.**

Both crews (`0b77b3b5` and `a306e9ba`) were spawned under secondmate `9824fe5b` on
`opencode/big-pickle` (the #1 rung on the model ladder). Per fleet-lessons.md
(2026-08-09), big-pickle rejects any turn where thinking mode is enabled with:
`400: "The reasoning_content in the thinking mode must be passed back to the API"`.
The pi-web SSE layer surfaces this as `Provider finish_reason: error`.

**Secondary cause: big-pickle rate limit exhaustion.**

The parent secondmate `9824fe5b` died with an explicit `429: FreeUsageLimitError`.
Rate-limit state confirms big-pickle is **exhausted** (retryAfterSeconds: 900).
The crews hit both conditions simultaneously — thinking-mode 400 AND 429 exhaustion.

**Why it wasn't caught at spawn:** The FixFlags system upgrade secondmate should
have called `session_set_thinking(<id>, "off")` at first action per fleet-briefs
protocol, but the parent secondmate `9824fe5b` itself errored before it could
enforce the model/thinking line on its children. The children inherited the
default thinking-enabled state and spawned on the exhausted big-pickle.

## Recovery executed — final status

### Actions taken
1. ✅ Stale rate-limit marks reset: `POST /api/rate-limits/reset` for `gemma-4-26b-a4b-it:free` (openrouter)
2. ✅ Parent secondmate `9824fe5b` archived (cleared stale 429 chip)
3. ✅ Both erroring sessions (0b77b3b5, a306e9ba) model-switched to `opencode/nemotron-3-ultra-free` + `thinking: off`
4. ✅ Retried via `POST /api/project/chat` (steer failed — sessions were idle, not streaming; chat API starts new turns)
5. ✅ Session stats confirmed: both retried sessions on `nemotron-3-ultra-free`, `thinking=off`, `streaming=False` (completed)
6. ✅ Stale error chips archived: `0b77b3b5` + `a306e9ba` archived via `POST /api/fleet/archive` (fleet error count 13→11)
7. ✅ big-pickle fully recovered: `status=ok`, `limitReached=false` (cooldown expired, ~9 min elapsed)

### Requeue outcome

Both deliverables were **already implemented** before the retry. The original crew
runs completed the work before hitting the provider error; the retried sessions on
nemotron-3-ultra-free with thinking OFF verified the existing work by running tests.

| Crew | Deliverable | Files changed | Tests | Status |
|------|-------------|---------------|-------|--------|
| Crew-1 (pi-web) | worker-contract validation | lib/worker-contract.mjs (new), lib/mate.mjs (+47), lib/crew-tools.mjs (+44), scripts/test-session-tools.mjs (+86) | 117 checks pass | ✅ Done |
| Crew-2 (fixflags) | heartbeat evidence hardening | scripts/agent-heartbeat.mjs (+132), scripts/agent-heartbeat.test.mjs (+48) | 19 tests pass (12+7) | ✅ Done |

### Final model ladder state

| Ladder rung | Provider | Model | Status |
|-------------|----------|-------|--------|
| #1 | opencode | big-pickle | ✅ OK (recovered — cooldown expired) |
| #2 | opencode | nemotron-3-ultra-free | ✅ OK (used for retry) |
| #3 | openrouter | cohere/north-mini-code:free | ✅ OK |
| #4 | openrouter | google/gemma-4-26b-a4b-it:free | ✅ OK (reset) |
| #5 | opencode | laguna-s-2.1-free | ✅ OK |

**Remaining stale marks (not on ladder — no impact on crew dispatch):**
- `deepseek-v4-flash-free`, `mimo-v2.5-free` (opencode, 900s cooldown) — not ladder rungs
- `nvidia/nemotron-3-super-120b`, `nvidia/nemotron-nano-9b-v2`, `gpt-oss-20b` (openrouter) — not ladder rungs
- `cursor/gpt-5.2`, `cursor/claude-sonnet-5-medium`, `cursor/composer-2.5` — FreeUsageLimitError, 21-24 day monthly cap, not on opencode/openrouter ladder

### Residual risks

1. **big-pickle cooldown now expired** — model is fully recovered ✅. Future spawns
   can safely use it, but must enforce `thinking: off` at spawn.
2. **Thinking-mode passthrough remains the critical control** — the model/thinking line
   must be baked into every crewmate brief's first action. Without it, big-pickle
   400s regardless of rate-limit state.
3. **Stale error marks on non-ladder models** — deepseek-v4, mimo, and cursor monthly-cap
   models remain exhausted but are not on the crew ladder, so no dispatch impact.
4. **maxParallelTasks=8** blocked immediate spawning; the workaround (model-switch +
   chat-retry on existing error sessions) succeeded. Future retries should use the same
   pattern when the limit is saturated.
