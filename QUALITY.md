# Quality

*Verification matrix: risks, required checks, and evidence.*

## The three tiers

| Tier | Question | Current readiness |
|------|----------|-------------------|
| Truth | Are audits accurate? | ~95% |
| Strength | Does the platform work reliably? | ~85% |
| Touch | Does the product feel world-class? | ~35% |

Ratings: BLOCKER (🚫 → ships to no one), CRITICAL (⚠️ → causes churn within 30d), IMPORTANT (🔶 → affects satisfaction), POLISH (🔵 → nice to have).

## Verification matrix

### Truth — Accuracy

| Risk | Rating | Required check | Evidence |
|------|--------|---------------|----------|
| False positives after check changes | ✅ DONE | Real-site regression suite: frozen HTML fixtures with expected flag profiles | 8 fixtures in `accuracy-corpus.ts`; `npm run accuracy:eval` + `report-quality-eval.test.ts` in CI |
| AI judge hallucinates rubrics | ✅ DONE | Bad schema → hard reject. Empty evidence → discard. Wrong rubric → fail. | `judge-contract.test.ts` + prescription contract; blank evidence discarded in `mergePrescriptionResults` |
| CheckId never fires | ✅ DONE | Check trigger matrix: every checkId fires from at least one input | All IDs generated from `ALL_CHECK_IDS` and exercised by `checks.test.ts` |
| Unclear what each check verifies | ✅ DONE | Verification rules for every checkId | All documented |
| Form validation | ✅ DONE | Form validation ratio test (50% threshold) | `checks.test.ts` asserts IMPORTANT vs POLISH by ratio |
| Score math edge cases | ✅ DONE | computeRubricScores: all CRITICAL, module failures, PageSpeed unavailable | `checks.test.ts` computeRubricScores suite |
| Marketing copy violations | ✅ DONE | Banned phrases, no speculation, no fake member counts | Tests pass |

### Strength — Reliability

| Risk | Rating | Required check | Evidence |
|------|--------|---------------|----------|
| Data corruption on persist | ✅ DONE | `persistDeterministicFlags` and `persistTriageResults`: 0 flags, 100 flags, duplicates, AI failures, enrichments | `persist-functions.test.ts` covers all five |
| Pipeline failures mid-audit | ✅ DONE | QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED. Fail at any step. Timeout halfway. Retry after crash. | `run-audit.test.ts` drives `runAudit` across every path |
| Billing enforcement leaks | ✅ DONE | Free user gets 402 on paid endpoint. Paying user never gets blocked on owned features. | Route tests for api-keys + projects assert 402/allow |
| API route contracts | 🔶 IMPORTANT | Critical path: 200/400/401/402/403/404 on checks, status, re-check, api-keys, projects | Critical path covered; remaining routes pending |
| Rate limiting | 🔶 IMPORTANT | Anonymous: 1 teaser scan (cookie + IP soft ceiling). Free account: 3 lifetime new URL checks. Paid: plan limit. Redis outage fail-open is intentional availability tradeoff. | Partially implemented |
| Auth / session integrity | 🔶 IMPORTANT | Claim-before-next, entitlements, re-check never gated | Claim + redirect + monitoring tests; full login/logout E2E still open |
| CI pipeline | ✅ DONE | CI and local full verification use `scripts/validate.mjs`. | GitHub Actions runs `npm run validate:full` plus browser journeys |
| Migration safety | ⚠️ CRITICAL | `npm run verify` runs `db:check` + `db:drift`. Drift detection passes. | Passes |
| Worker crash recovery | 🔶 IMPORTANT | Worker dies mid-capture → retry. Detection tested. Recovery path untested. | Partial |
| Queue job processing | ✅ DONE | Live PostgreSQL/Redis evaluation submits, processes, retries after failure, and checks duplicate-job idempotency. | `npm run agent -- eval recovery` |

### Touch — Experience

| Risk | Rating | Required check | Evidence |
|------|--------|---------------|----------|
| Report rendering per audit state | 🔶 IMPORTANT | Progressive QUEUED/CAPTURING/CHECKING/COMPLETED + FAILED panel | Component tests for progressive, failure, empty flags |
| Canonical complete report contract | ⚠️ CRITICAL | One report workspace contains every unresolved Flag; legacy details routes redirect; anonymous shows real evidence + exactly one complete non-placeholder fix prompt; remaining prompts stay gated | `finish-plan.test.ts`, product contract guard, browser matrix, customer-journey plan |
| Empty states | 🔶 IMPORTANT | No scans, no flags, deleted audit — helpful prompts, not errors | `ReportFixLoop` + `EmptyState` tests; deleted-audit still manual |
| Loading / progress UI | 🔶 IMPORTANT | Progress bar, skeleton screens, polling behavior | Progressive tests + AiReviewPendingRefresh timeout UX |
| Mobile-responsive layout | 🔶 IMPORTANT | Report page at 375px, 768px, 1280px | No responsive tests |
| Screenshot display | 🔶 IMPORTANT | Load, fail gracefully, placeholder fallback | Partial |
| Accessibility basics | ⚠️ CRITICAL | Keyboard nav, 44px targets, screen reader names, zoom/reflow, reduced motion | Lint + browser matrix |
| Page load performance | 🔶 IMPORTANT | Canonical report loads without unnecessary duplicate report bundles | Production build route output |
| Coverage thresholds | 🔵 POLISH | Vitest coverage config | Not configured |

## Automated guards

| Guard | Command | What it checks | CI |
|-------|---------|---------------|----|
| TypeScript | `npm run typecheck` | Type errors | Yes |
| ESLint | `npm run lint` | Code quality, a11y, imports | Yes |
| Unit tests | `npm run test:unit` | Lib-level correctness | Yes |
| Brand hex | `npm run brand:hex-guard` | Brand color compliance | Yes |
| UI drift | `npm run ui:drift-guard` | Design system drift | Yes |
| Product contract | `npm run product:contract-guard` | Stale routes, homepage bloat, prompt/sample/share regressions, focused deep imports | Yes |
| Scan accuracy | `npm run accuracy:eval` | Gold 0 false blockers, builder top-3, demo v1 repair, non-HTML regression | Yes (via `validate.mjs` full gate) |
| SEO | `npm run seo:guard` | SEO compliance | Yes |
| Migration | `npm run db:check` | Migration status | Verify script |
| Drift | `npm run db:drift` | Schema drift | Verify script |
| Build | `npm run build` | Next.js production build | Yes |
| Worker build | `npm run worker:build` | Worker compile | Yes |
| Docker image | `docker build -t fixflags:local .` | Railway packaging (`npm ci`, Chromium, Next build) | No (run locally when Dockerfile/package*.json change) |

## Monetization blockers

All five now have automated coverage, run in CI via `npm run test:unit`:
1. ✅ Real-site regression fixtures — `regression-sites.test.ts` (HTML-derivable checks)
2. ✅ AI judge contract validation — `judge-contract.test.ts` + blank-evidence discard
3. ✅ Persist layer — `persist-functions.test.ts` (0/100 flags, duplicates, AI-failure fallback, enrichments)
4. ✅ Pipeline state machine — `run-audit.test.ts` (transitions, fail-at-step, timeout, retry-after-crash)
5. ✅ Billing gating enforcement — route tests assert 402 for free, allow for paid (`/api/checks`, api-keys, projects)

Remaining hardening (not blocking): freeze screenshot/flow/PageSpeed modules into the regression suite; extend route contract tests to the remaining API endpoints; run manual report contract smoke (below); full-browser adjudication for SSR sites (e.g. linear.app).

**Accuracy completion plan:** [`.agents/sessions/launch-readiness-completion-plan.md`](.agents/sessions/launch-readiness-completion-plan.md)

## Report contract smoke (manual CRITICAL)

Until automated Touch-tier tests cover report chrome:

1. `/report/[id]`: identity → optional diff → complete ranked Fix List → Contract/Memory → Journey/Flow/Timeline → previews/gates/actions → owner re-check.
2. Anonymous report exposes every problem and evidence summary, exactly one real prompt, and one contextual signup moment for remaining prompts.
3. `/report/[id]/details`, sample details, and share details redirect to their canonical surfaces after enforcing the same access contract.
4. Progressive route shows captures and every verified Flag in the same ranked explorer; Contract/timeline are collapsible. COMPLETED holds the frame until refresh.
5. `/samples` and loading shell never render an empty main area. Homepage and sample do not query production audit rows.
6. Password share metadata is generic; authorize once, refresh without another view increment, open details, then revoke.
7. Verify 375, 768, and 1280px, keyboard focus, 200% zoom, reduced motion, partial/failure/deleted states.

## Completion standard

Completion requires evidence, not confidence. Before claiming work:
- [ ] Run `npm run typecheck` — zero errors
- [ ] Run `npm run lint` — zero errors
- [ ] Run `npm run test:unit` and record the measured result for that run.
- [ ] Run relevant guards
- [ ] Verify actual behavior (not just test pass)
- [ ] Check edge cases, responsive states, loading/empty/error states
- [ ] Confirm no secrets written, no fake data, no hardcoded answers
- [ ] Report UI: run density smoke checklist when touching report chrome
