# FixFlags Testing Strategy

*Last updated: 2026-07-11*

> **Ship readiness evidence:** See [`QUALITY.md`](QUALITY.md) for current automated coverage and ratings. This doc tracks residual hardening goals and the original monetization bar.

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
| Real-site regression suite | ✅ DONE | HTML-derivable checks frozen in `regression-sites.test.ts`. Screenshot/flow/PageSpeed modules still need fixtures. |
| AI judge contract validation | ✅ DONE | `judge-contract.test.ts` + blank-evidence discard |
| Check trigger matrix | ✅ DONE | Every checkId fires from at least one input. Count: AGENTS.md Project facts (`ALL_CHECK_IDS` in `lib/audit/check-ids.ts`). |
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
| Persist layer (no data corruption) | ✅ DONE | `persistDeterministicFlags` / `persistTriageResults` — `persist-functions.test.ts` |
| Pipeline state machine | ✅ DONE | QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED — `run-audit.test.ts` |
| Billing gating enforcement | ✅ DONE | Route tests: `/api/checks`, api-keys, projects assert 402/allow |
| API route contracts | ⚠️ CRITICAL | Primary paid endpoints tested; remaining API routes still lack handler-level tests |
| Rate limiting | ⚠️ CRITICAL | Anonymous users get 3 checks. Paid users get their plan limit. Overages are gated. Partial coverage only. |
| Auth / session management | ⚠️ CRITICAL | Login, logout, session expiry, plan entitlements. Auth env config is tested. Runtime behavior is not. |
| CI pipeline | ⚠️ CRITICAL | GitHub Actions runs typecheck/lint/guards/test/build. Local `npm run verify` is stricter (includes DB checks). |
| Database migration safety | ⚠️ CRITICAL | `npm run verify` runs `db:check` + `db:drift`. Not in CI. A bad migration on deploy corrupts production data. |
| Worker crash recovery | 🔶 IMPORTANT | `stuck-audit-recovery.test.ts` for detection. Recovery path partially tested. |
| Queue job processing | 🔶 IMPORTANT | BullMQ jobs submitted, processed, failed, retried. Limited test coverage. |

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
TRUTH           ████████████████████  ~90%  (fixtures + AI judge covered; extend screenshot/flow modules)
STRENGTH        ████████████████░░░░  ~80%  (persist, pipeline, billing route tests done; auth/rate-limit gaps remain)
TOUCH           ██░░░░░░░░░░░░░░░░░░  10%  (component tests missing entirely)

Monetization blockers with automated coverage (see QUALITY.md):
┌──────────────────────────────────────────────────────────────┐
│ ✅ 1. Real-site regression fixtures (HTML-derivable checks)   │
│ ✅ 2. AI judge contract validation                            │
│ ✅ 3. Persist layer tests                                     │
│ ✅ 4. Pipeline state machine tests                            │
│ ✅ 5. Billing gating enforcement (/api/checks + paid routes)  │
└──────────────────────────────────────────────────────────────┘

Remaining hardening (not blocking ads): extend route contract tests, auth/session runtime tests, component tests.
```

## What I need to see before I say "ship"

The five monetization blockers above now have automated test coverage. Residual hardening before scaling distribution:

1. **Extend route contract tests** — Cover remaining API endpoints beyond `/api/checks`, api-keys, and projects.
2. **Auth/session runtime tests** — Login, logout, session expiry, plan entitlements at runtime.
3. **Screenshot/flow/PageSpeed fixtures** — Freeze non-HTML-derivable check modules into the regression suite.
4. **Component tests for Touch tier** — Report rendering, empty states, loading UI.

**When residual hardening is done, scale distribution with confidence.**

A note on Touch: the visual polish is already strong. Component tests won't make or break launch. The five Strength/Truth blockers are closed.
