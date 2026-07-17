# Quality

*Verification matrix: risks, required checks, and evidence.*

## The three tiers

| Tier | Question | Current readiness |
|------|----------|-------------------|
| Truth | Are audits accurate? | 80% |
| Strength | Does the platform work reliably? | 25% |
| Touch | Does the product feel world-class? | 10% |

Ratings: BLOCKER (🚫 → ships to no one), CRITICAL (⚠️ → causes churn within 30d), IMPORTANT (🔶 → affects satisfaction), POLISH (🔵 → nice to have).

## Verification matrix

### Truth — Accuracy

| Risk | Rating | Required check | Evidence |
|------|--------|---------------|----------|
| False positives after check changes | ✅ DONE | Real-site regression suite: frozen HTML fixtures with expected flag profiles | 6 fixtures in `regression-sites.test.ts`, run in CI (HTML-derivable checks) |
| AI judge hallucinates rubrics | ✅ DONE | Bad schema → hard reject. Empty evidence → discard. Wrong rubric → fail. | `judge-contract.test.ts` + prescription contract; blank evidence discarded in `mergePrescriptionResults` |
| CheckId never fires | ✅ DONE | Check trigger matrix: every checkId fires from at least one input | All IDs via `checks.test.ts` (count: AGENTS.md Project facts → `ALL_CHECK_IDS`) |
| Unclear what each check verifies | ✅ DONE | Verification rules for every checkId | All documented |
| Form validation | ⚠️ CRITICAL | Form validation ratio test (50% threshold) | Not implemented |
| Score math edge cases | ⚠️ CRITICAL | computeRubricScores tested. Edge cases: all CRITICAL, module failures | Partial |
| Marketing copy violations | ✅ DONE | Banned phrases, no speculation, no fake member counts | Tests pass |

### Strength — Reliability

| Risk | Rating | Required check | Evidence |
|------|--------|---------------|----------|
| Data corruption on persist | ✅ DONE | `persistDeterministicFlags` and `persistTriageResults`: 0 flags, 100 flags, duplicates, AI failures, enrichments | `persist-functions.test.ts` covers all five |
| Pipeline failures mid-audit | ✅ DONE | QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED. Fail at any step. Timeout halfway. Retry after crash. | `run-audit.test.ts` drives `runAudit` across every path |
| Billing enforcement leaks | ✅ DONE | Free user gets 402 on paid endpoint. Paying user never gets blocked on owned features. | Route tests for api-keys + projects assert 402/allow |
| API route contracts | ⚠️ CRITICAL | Every route: 200 valid, 400 bad, 401 no auth, 404 not found, 429 rate limited | api-keys + projects tested; other routes pending |
| Rate limiting | ⚠️ CRITICAL | Anonymous: 3 checks. Paid: plan limit. Overage gating. | Not implemented |
| Auth / session integrity | ⚠️ CRITICAL | Login, logout, session expiry, plan entitlements at runtime | Not implemented |
| CI pipeline | ⚠️ CRITICAL | Solo founder can `npm run verify` before shipping. BLOCKER with second person. | GitHub Actions runs subset; local verify is stricter |
| Migration safety | ⚠️ CRITICAL | `npm run verify` runs `db:check` + `db:drift`. Drift detection passes. | Passes |
| Worker crash recovery | 🔶 IMPORTANT | Worker dies mid-capture → retry. Detection tested. Recovery path untested. | Partial |
| Queue job processing | 🔶 IMPORTANT | Jobs submitted, processed, failed, retried | 0 tests |

### Touch — Experience

| Risk | Rating | Required check | Evidence |
|------|--------|---------------|----------|
| Report rendering per audit state | ⚠️ CRITICAL | Every state (QUEUED, CAPTURING, COMPLETED, FAILED) produces correct UI | Manual testing |
| Empty states | ⚠️ CRITICAL | No scans, no flags, deleted audit — helpful prompts, not errors | Manual testing |
| Loading / progress UI | 🔶 IMPORTANT | Progress bar, skeleton screens, polling behavior. Text tested. Component untested. | Partial |
| Mobile-responsive layout | 🔶 IMPORTANT | Report page at 375px, 768px, 1280px | No responsive tests |
| Screenshot display | 🔶 IMPORTANT | Load, fail gracefully, placeholder fallback | Partial |
| Accessibility basics | 🔵 POLISH | Keyboard nav, screen reader support, color contrast | Lint rules only |
| Page load performance | 🔵 POLISH | Report page <2s | Not measured |
| Coverage thresholds | 🔵 POLISH | Vitest coverage config | Not configured |

## Automated guards

| Guard | Command | What it checks | CI |
|-------|---------|---------------|----|
| TypeScript | `npm run typecheck` | Type errors | Yes |
| ESLint | `npm run lint` | Code quality, a11y, imports | Yes |
| Unit tests | `npm run test:unit` | Lib-level correctness | Yes |
| Brand hex | `npm run brand:hex-guard` | Brand color compliance | Yes |
| UI drift | `npm run ui:drift-guard` | Design system drift | Yes |
| SEO | `npm run seo:guard` | SEO compliance | Yes |
| Migration | `npm run db:check` | Migration status | Verify script |
| Drift | `npm run db:drift` | Schema drift | Verify script |
| Build | `npm run build` | Next.js production build | Yes |
| Worker build | `npm run worker:build` | Worker compile | Yes |

## Monetization blockers

All five now have automated coverage, run in CI via `npm run test:unit`:
1. ✅ Real-site regression fixtures — `regression-sites.test.ts` (HTML-derivable checks)
2. ✅ AI judge contract validation — `judge-contract.test.ts` + blank-evidence discard
3. ✅ Persist layer — `persist-functions.test.ts` (0/100 flags, duplicates, AI-failure fallback, enrichments)
4. ✅ Pipeline state machine — `run-audit.test.ts` (transitions, fail-at-step, timeout, retry-after-crash)
5. ✅ Billing gating enforcement — route tests assert 402 for free, allow for paid (`/api/checks`, api-keys, projects)

Remaining hardening (not blocking): freeze screenshot/flow/PageSpeed modules into the regression suite; extend route contract tests to the remaining API endpoints.

## Completion standard

Completion requires evidence, not confidence. Before claiming work:
- [ ] Run `npm run typecheck` — zero errors
- [ ] Run `npm run lint` — zero errors
- [ ] Run `npm run test:unit` — all passing (count measured per run; see `AGENTS.md` Project facts)
- [ ] Run relevant guards
- [ ] Verify actual behavior (not just test pass)
- [ ] Check edge cases, responsive states, loading/empty/error states
- [ ] Confirm no secrets written, no fake data, no hardcoded answers
