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

## Working models right now (model ladder rungs)

| Ladder rung | Provider | Model | Status |
|-------------|----------|-------|--------|
| #1 | opencode | big-pickle | ❌ EXHAUSTED (429, ~9 min cooldown) |
| #2 | opencode | nemotron-3-ultra-free | ✅ OK (1M ctx, strongest free agentic) |
| #3 | openrouter | cohere/north-mini-code:free | ✅ OK (256K ctx) |
| #4 | openrouter | google/gemma-4-26b-a4b-it:free | ⏰ EXHAUSTED (10s cooldown) |
| #5 | opencode | laguna-s-2.1-free | ✅ OK (256K ctx) |

**Fallback recommendation:** `opencode/nemotron-3-ultra-free` — the #2 ladder rung,
last known-good for heavy agentic work, currently healthy.

## Cooldown timeline

| Model | Error | resetAt | Cooldown from now |
|-------|------|---------|-------------------|
| big-pickle | FreeUsageLimitError 429 | 1786365747094 | ~9 min ⏰ |
| gpt-5.3-codex-spark | FreeUsageLimitError 429 | 1786363092738 | ❌ already expired |
| gemma-4-26b-a4b-it:free | rate_limit | 1786364873327 | ⏰ already expired (should self-clear) |
| deepseek-v4-flash-free | FreeUsageLimitError 429 | 1786362221030 | ❌ expired (stale record) |
| mimo-v2.5-free | rate_limit | 1786106614815 | ❌ far-future (stale) |

## Recovery plan

### Phase 1: Reset stale rate-limit marks (AUTO-FIX)
Reset marks for models whose cooldown has already expired but whose error state
is stale in the rate-limits file. Run `POST /api/rate-limits/reset` for:
- `gemma-4-26b-a4b-it:free` (openrouter) — 10s cooldown, should self-clear
- `deepseek-v4-flash-free` (opencode) — 49 min expired, stale record
- `mimo-v2.5-free` (opencode) — stale record (resetAt far in the past relative to current retry window)

### Phase 2: Re-dispatch two crews on nemotron-3-ultra-free
Spawn replacements immediately (no need to wait for big-pickle's 9-min cooldown):
1. **Crew-1 (pi-web):** enforce persona-native worker dispatch contract
2. **Crew-2 (fixflags):** deterministic heartbeat evidence integrity

Both crews must:
- Set `session_set_thinking(<id>, "off")` at first action
- Run on `opencode/nemotron-3-ultra-free` (NOT big-pickle)
- Follow file-partition discipline (pi-web crew writes pi-web files only;
  fixflags crew writes fixflags files only)

### Phase 3: Verify + recover parent
- Parent secondmate `9824fe5b` is in error state — archive it (per fleet-lessons
  2026-08-07: don't leave done-but-error sessions on the panel; stale 429 chips
  require a successful turn or archive to clear).
- If big-pickle self-clears after cooldown, future secondmates can resume using
  it with thinking OFF.

## Verification commands

```bash
# 1. Confirm reset of stale rate-limit marks
curl -s -X POST http://localhost:4747/api/rate-limits/reset \
  -H 'Content-Type: application/json' \
  -d '{"provider":"openrouter","modelId":"google/gemma-4-26b-a4b-it:free"}'
curl -s -X POST http://localhost:4747/api/rate-limits/reset \
  -H 'Content-Type: application/json' \
  -d '{"provider":"opencode","modelId":"deepseek-v4-flash-free"}'

# 2. After crews complete, verify tests pass
# Crew-2 (fixflags):
cd /Users/saadbenryane/Code/fixflags && node scripts/agent-heartbeat.test.mjs
# Crew-1 (pi-web):
cd /Users/saadbenryane/Code/pi-web && npm run validate:api && npm run validate:lib

# 3. Confirm rate-limit state cleared
curl -s http://localhost:4747/api/rate-limits | python3 -c "
import sys,json; d=json.load(sys.stdin)
for m in d.get('modelHealth',[]): print(m['provider'], m['modelId'], m['status'])
"
```

## Residual risks

1. **big-pickle 9-min cooldown** — new spawns may still land on it if the ladder
   picks it first. Mitigation: spawn crews explicitly on nemotron-3-ultra-free.
2. **OpenRouter free tiers** (20 RPM / 200 RPD) — shared contention across all
   free users. nemotron-3-ultra-free is on opencode which has separate limits.
3. **Thinking-mode passthrough** — if the model/thinking line isn't enforced at
   spawn, big-pickle will 400 again even after cooldown clears. Must be baked
   into the crewmate brief first-action line.
4. **Stale parent secondmate** `9824fe5b` needs archival to clear the fleet panel.
