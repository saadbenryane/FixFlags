# Launch readiness completion plan

*Reconciled after launch-quality-accuracy pass. Date: 2026-07-23.*

## Honest verdict

FixFlags is **technically chargeable** and **soft-launchable on scan accuracy**, but **not ready to scale distribution** or promise audit-grade trust on every persona without the remaining gates below.

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Truth (accuracy) | ~95%, gate enforced | `npm run accuracy:eval`, 8 HTML fixtures, demo v1 repair, non-HTML regression |
| Strength (reliability) | ~85% | `npm run verify` green; release bar implemented but not executed with creds |
| Touch (experience) | ~35% | Report contract manual smoke open; responsive automation thin |
| Product completion | In progress | Board `current-product-completion` |

**Do not treat BOARD “done” as shipped until PR merges to `main` and release verification passes.**

---

## Phase 1 — Land accuracy work on main (now)

**Goal:** Make the accuracy pass the canonical truth, not a stranded branch.

| Action | Owner | Done when |
|--------|-------|-----------|
| Merge PR #4 (`cursor/launch-quality-accuracy-bff3`) | Release owner | `main` includes `accuracy:eval`, parser fixes, builder fixtures |
| Run `npm run verify` on `main` post-merge | Agent/CI | Green |
| Run `npm run accuracy:eval` on `main` | Agent/CI | 0 failures |

**Architecture delivered in this pass:**

- `lib/audit/accuracy-corpus.ts` — single fixture expectation source
- `lib/audit/fixture-html.ts` — shared offline check runner
- `lib/audit/fixture-sanitize.ts` — capture pipeline (scripts stripped, scanner-safe)
- `scripts/accuracy-eval.ts` — CI gate (gold 0 false blockers, builder caps, demo repair)
- `npm run accuracy:probe` — live HTML probe for adjudication

**Not temporary:** Parser fixes in `metadata.ts` and `messaging-clarity.ts` are structural. Fixture sanitization removes scripts only; visible copy is preserved.

---

## Phase 2 — Release verification (blocked on credentials, not deferrable)

**Goal:** Prove production-like runtime before distribution claims.

From `.agents/handoffs/current-product-completion.md`:

1. `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
2. `RELEASE_FRESH_DATABASE_URL` + `RELEASE_ALLOW_DATABASE_RESET=true` (name includes `release` or `test`)
3. `RELEASE_CONTAINER_ENV_FILE`
4. `RELEASE_SMOKE_URL` (+ bearer if required)
5. **`npm run verify:release`** end-to-end

**Command chain:** clean install → disposable DB reset → full manifest (includes `accuracy:eval`) → E2E → Docker build → container smoke → deployed health/AI/browser probes.

**Anti-pattern:** Do not weaken doctor, skip release steps, or substitute route-registry metadata for integration proof.

---

## Phase 3 — Credentialed journey matrix (now, not later)

**Goal:** Every revenue-critical path works for real users — not just public E2E.

| Journey | Current coverage | Required proof |
|---------|------------------|----------------|
| Anonymous wedge | Unit + partial E2E | Paste URL → progressive → 1 prompt → claim → copy → re-check diff |
| Passkeys / 2FA / recovery | Unit | Sign-in, recovery, session persistence |
| Billing / webhooks | Route tests | Checkout, portal, webhook signature, 402 gates |
| Re-check / diff / Remember | Unit + sample | FULL re-check, diff accuracy, Remember write |
| Protected sharing | Route + manual | Password share, view count, revoke |
| Product Watch | Unit | Regression email, idempotent notify |
| GitHub Fix PR | Integration | Token encrypt, PR open path |
| Support / admin | Route guards | Admin funnel, help escalation |
| MCP | Contract tests | Context tools, plan-mode |
| CLI | `npm run test:cli` | check → plan → verify task shape |

**Deliverable:** `.agents/sessions/credentialed-journey-matrix.md` with pass/fail per row, or automated E2E suite behind `E2E_FULL=true`.

Route registry (`scripts/route-contract-registry.mjs`) inventories cases — it does **not** execute them.

---

## Phase 4 — Accuracy hardening (design properly, no hacks)

**Goal:** Close Truth gaps without widening severity or case-specific production logic.

### 4.1 Full-browser adjudication

| Site | Gap | Action |
|------|-----|--------|
| linear.app | 3 IMPORTANT on HTML-only probe (SSR a11y artifacts) | Prod dogfood with full Playwright; adjudicate FP/FN; freeze rendered fixture if needed |
| replit.com | 403 on probe | Curated fixture or accept skip with documented reason |
| v0.dev | Parser fixed live; no frozen fixture | Capture curated snapshot OR document live-probe-only |

### 4.2 Non-HTML regression expansion

Freeze real outputs into `non-html-regression.json` (pattern exists):

- Slow LCP / CLS mobile case (partial — `inp-poor` added)
- Overlay blocking CTA
- Dead-end CTA flow
- API 401 engagement (`beat-scout-precision.test.ts` partial)

### 4.3 Fixture capture maturity

Replace full-page minified dumps with **curated DOM extracts** where possible (hero + trust + nav). Keep `npm run accuracy:capture-fixtures` for refresh; record `source` and `captured` in fixture header.

### 4.4 Eval consolidation (done in this pass)

- ~~Triplicated fixture specs~~ → `accuracy-corpus.ts`
- ~~Duplicate `runFixtureChecks`~~ → `fixture-html.ts`

`regression-sites.test.ts` remains a narrower HTML-derivable subset — document intentional scope in test file header.

---

## Phase 5 — Touch and report contract (parallel, not deferred)

**Goal:** Product feels world-class at first use.

### 5.1 Manual report contract smoke (QUALITY.md report contract)

Run on **one anonymous** and **one signed-in** journey:

1. `/report/[id]` hierarchy: identity → diff → complete ranked Fix List → Contract/Memory → Journey/Flow/Timeline → previews/gates/actions → re-check
2. Anonymous: three evidence summaries, exactly one **real** complete fix prompt (clipboard ≠ gate string), one signup moment for remaining prompts
3. `/report/[id]/details`, sample details, and share details redirect to their canonical report surfaces with the same access checks
4. Progressive route: captures and verified Flags append to the canonical ranked explorer; COMPLETED holds frame
5. `/samples` and loading shell never empty; homepage/sample do not query production audits
6. Password share: generic metadata, single authorize, no view inflation, revoke works
7. 375 / 768 / 1280px, keyboard, 200% zoom, reduced motion, partial/failure/deleted states
8. Production brand: logo lockup visible (Phase 0 done via `fix-live-images`)

### 5.2 Touch automation backlog

| Item | Rating | Next step |
|------|--------|-----------|
| Mobile responsive report | IMPORTANT | Playwright viewport matrix beyond homepage |
| Screenshot display failures | IMPORTANT | Component test for placeholder fallback |
| Deleted-audit empty state | IMPORTANT | Component or E2E |
| Page load performance | IMPORTANT | Route bundle size assertion on focused report |

---

## Phase 6 — Product completion track (current-product-completion)

Remaining from handoff (after release verification):

1. Runtime recovery on **application audit queue** (not only isolated BullMQ eval)
2. Report / MCP / marketing module splits + dead-code adjudication (behavior-driven, not size-driven)
3. Launch Check completeness signals: Contract merge-not-wipe, watch FULL re-check, Studio share honesty

---

## Phase 7 — Distribution gates (explicit defer)

Do **not** scale (Product Hunt, paid ads) until:

- [ ] `verify:release` passes with credentials
- [ ] Credentialed journey matrix signed off
- [ ] Manual report contract smoke passed (anonymous + signed-in)
- [ ] ≥100 completed scans for funnel P2 baseline (`.agents/handoffs/launch-funnel-p2.md`)
- [ ] linear.app full-pipeline adjudication complete

---

## Phase 8 — Code hygiene principles (ongoing)

1. **One canonical source** per contract: corpus, copy, report hierarchy, entitlements
2. **No production case logic** to make fixtures green
3. **No silent catches** on billing, auth, or pipeline paths
4. **Skills and AGENTS router** updated whenever a new gate ships
5. **Evidence in `.agents/sessions/`** for manual adjudication; **prevention in tests/types/CI** for regressions

---

## Command reference

| Task | Command |
|------|---------|
| Offline accuracy gate | `npm run accuracy:eval` |
| Live HTML adjudication | `npm run accuracy:probe -- <url>...` |
| Refresh builder fixtures | `npm run accuracy:capture-fixtures` |
| Demo repair proof | `npm run demo:audit:offline` |
| Full local gate | `npm run verify` |
| Release gate | `npm run verify:release` |
| Agent context | `npm run agent -- context accuracy` |
| Agent eval | `npm run agent -- eval accuracy` |

---

## Immediate next actions (ordered)

1. ~~Deploy / restore live brand assets~~ **Done** — board `fix-live-images` (localPatterns + `unoptimized` + guard).
2. Execute [customer-journey-completion-plan.md](./customer-journey-completion-plan.md) **Phases 1–3** (anon evidence truth, honest Copy, score/status, nav CTAs) before distribution claims.
3. Provision release credentials; run `verify:release`
4. Execute credentialed journey matrix (manual checklist minimum)
5. Run manual report contract smoke (2 journeys) including production dogfood acceptance criteria
6. linear.app full-pipeline dogfood + adjudication
7. Expand non-HTML regression fixtures from prod captures
8. Touch-tier responsive automation for report routes

See also: [customer-journey-completion-plan.md](./customer-journey-completion-plan.md) for remaining first-value trust gaps.
