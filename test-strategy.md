# FixFlags Testing Strategy

## The 3 Categories

### 1. Truth — audits are accurate
*"Does the report find real issues and skip fake ones?"*

### 2. Strength — the platform works  
*"Does every scan complete? Does data stay intact?"*

### 3. Touch — the product feels world-class
*"Is it fast, clear, and beautiful?"*

---

## Readiness Ratings

| Badge | Meaning | Ships to paying users? |
|-------|---------|----------------------|
| 🚫 **BLOCKER** | Would lose a customer in their first session | No |
| ⚠️ **CRITICAL** | Would cause churn within 30 days | Not yet |
| 🔶 **IMPORTANT** | Affects satisfaction, not retention | Yes, but fix next |
| 🔵 **POLISH** | Nice to have — affects perception | Yes |

---

## Tier 1 — Truth (accuracy)

*What must be true for a paying customer to trust a single flag?*

| Issue | Rating | What we need |
|-------|--------|-------------|
| Real-site regression suite | 🚫 BLOCKER | 5-10 frozen HTML fixtures with expected flag profiles. Runs on every PR. Without this, we can't prove we fixed false positives. |
| AI judge contract validation | 🚫 BLOCKER | Bad schema → hard reject. Empty evidence → discard. Wrong rubric → fail. The AI is the highest-risk component. |
| Check trigger matrix | ✅ DONE | Every checkId fires from at least one input. 63/63 verified. |
| Verification rules for every check | ✅ DONE | Every checkId has a human-readable verification rule. |
| Form validation ratio | ⚠️ CRITICAL | We just added this (50% threshold). No test yet. |
| Score math | ⚠️ CRITICAL | computeRubricScores is tested. But edge cases (all CRITICAL, module failures) need explicit verification. |
| Marketing copy guardrails | ✅ DONE | Banned phrases, no speculation, no fake member counts. |

### Ready for monetization when:

> Every PR runs checks against frozen real-site HTML. A single unexpected flag kills the build. The AI judge has a fenced playground where it's tested against known-bad inputs and caught every time.

---

## Tier 2 — Strength (reliability)

*What must be true for a paying customer to trust the platform with their URL and their time?*

| Issue | Rating | What we need |
|-------|--------|-------------|
| Persist layer (no data corruption) | 🚫 BLOCKER | `persistDeterministicFlags` and `persistAuditResults` handle 0 flags, 100 flags, duplicates, and AI failures. Untested = data risk. |
| Pipeline state machine | 🚫 BLOCKER | QUEUED → CAPTURING → CHECKING → JUDGING → COMPLETED. Fail at any step. Timeout halfway through. Retry after crash. All untested. |
| Billing gating enforcement | 🚫 BLOCKER | `usage-limits.test.ts` tests the config values. The runtime enforcement in API routes is untested. A free user hitting a paid endpoint should get blocked. A paying user should never get a 402 on a feature they bought. |
| API route contracts | ⚠️ CRITICAL | Every route: valid input → 200, bad input → 400, no auth → 401, not found → 404, rate limited → 429. Currently zero tests. |
| Rate limiting | ⚠️ CRITICAL | Anonymous users get 3 checks. Paid users get their plan limit. Overages are gated. Untested = leaks revenue or frustrates users. |
| Auth / session management | ⚠️ CRITICAL | Login, logout, session expiry, plan entitlements. Auth env config is tested. Runtime behavior is not. |
| CI pipeline | ⚠️ CRITICAL | Solo founder can manually `npm run verify` before shipping. Becomes 🚫 BLOCKER with a second person committing. |
| Database migration safety | ⚠️ CRITICAL | `npm run verify` runs `db:check` + `db:drift`. Not in CI. A bad migration on deploy corrupts production data. |
| Worker crash recovery | 🔶 IMPORTANT | Worker dies mid-capture → retry. We have `stuck-audit-recovery.test.ts` for detection. Recovery path is untested. |
| Queue job processing | 🔶 IMPORTANT | BullMQ jobs submitted, processed, failed, retried. Zero tests. But the queue management code is relatively stable. |

### Ready for monetization when:

> We can simulate any failure mode in a test: PageSpeed 429, judge timeout, worker crash, database down. Each one produces a known, safe outcome — partial results, retry, or a clear error message. No silent data corruption. Every API route is documented and contracted.

---

## Tier 3 — Touch (experience)

*What must be true for a paying customer to feel they bought a world-class product?*

| Issue | Rating | What we need |
|-------|--------|-------------|
| Report rendering | ⚠️ CRITICAL | Every audit state (QUEUED, CAPTURING, COMPLETED, FAILED) produces correct UI. Flags, scores, screenshots all render. Currently tested by eye in dev. |
| Empty states | ⚠️ CRITICAL | No scans page, no flags page, no report page for deleted audit. Users see helpful prompts, not error screens. |
| Loading / progress UI | 🔶 IMPORTANT | Scan progress bar, skeleton screens, polling behavior. We have `audit-progress-copy.test.ts` for text. No component test. |
| Mobile-responsive layout | 🔶 IMPORTANT | Report page at 375px, 768px, 1280px. Currently no responsive tests. |
| Screenshot display | 🔶 IMPORTANT | Screenshots load, fail gracefully, fall back to placeholder. |
| Accessibility basics | 🔵 POLISH | Keyboard nav, screen reader support, color contrast. |
| Page load performance | 🔵 POLISH | Report page loads in under 2s. Lighthouse score. |
| Coverage thresholds | 🔵 POLISH | Currently no coverage config. Would give us visibility into untested code. |

### Ready for monetization when:

> A paying customer can: paste a URL → see a progress bar → get a report with flags and a score → share it → come back to see their history. Every step renders correctly and handles errors gracefully. No blank screens, no stuck spinners, no confusing copy.

---

## Summary

```
TRUTH           ████████████████░░░░  80%  (check triggers done, fixtures + AI judge missing)
STRENGTH        █████░░░░░░░░░░░░░░░  25%  (detection code exists, billing + pipeline untested)
TOUCH           ██░░░░░░░░░░░░░░░░░░  10%  (component tests missing entirely)

BLOCKERS before monetization:
┌──────────────────────────────────────────────────────────────┐
│ 🚫 1. Real-site regression fixtures (Truth — false positives)│
│ 🚫 2. AI judge contract validation (Truth — hallucinations)  │
│ 🚫 3. Persist layer tests (Strength — data corruption)       │
│ 🚫 4. Pipeline state machine tests (Strength — stuck scans)  │
│ 🚫 5. Billing gating enforcement (Strength — revenue leaks)  │
└──────────────────────────────────────────────────────────────┘
```

## What I need to see before I say "ship"

1. **Real-site fixtures in CI** — A PR adds 3+ frozen HTML files with expected flag profiles. Modifying a check and forgetting to update the fixture breaks the build. I see a red test when I introduce a false positive.
2. **AI judge fenced in tests** — Bad judge schema → rejected with clear error. Empty evidence → discarded. Output with hallucinated rubric → caught. The judge is a black box we can't fully control, but its I/O contract is locked.
3. **Persist layer has 10 test cases** — 0 flags, 100 flags, duplicates, AI failure after deterministic persist, all-CRITICAL flags, enrichments with gaps. I can prove `persistAuditResults` doesn't lose or corrupt data in any scenario.
4. **Pipeline handles every failure mode** — PageSpeed 429, judge timeout, screenshot fail, worker crash mid-capture, deadline exceeded. Each produces a known safe outcome: partial results, retry, or a clear error message. No silent stuck-at-40% scans.
5. **Billing enforcement is tested** — `GET /api/ai-review` returns 402 for free users. A Builder plan user can run their 25th scan. A Team plan user can invite a teammate. The config says X, the API enforces X.

**When those 5 are true, I'll run ads. Not before.**

A note on Tough: the visual polish is already strong. Component tests won't make or break launch. But I want the 5 BLOCKERs closed in the next 2 weeks.
