# Launch promise closeout plan

*From the scout audit `docs/investigations/launch-promise-audit.md` (2026-08-04). Date: 2026-08-04.*

## Honest verdict

The core loop is real and ships; the funnel contract is a **documented deliberate gate**, not an accident. `knowledge/execution.md:31` ("Honest acquisition — anonymous gets every Flag and evidence summary plus exactly one complete fix") matches the shipped gating (one demonstrated prompt, plan-mode prompt owner-only). The audit's P0 framing ("ship the plan prompt to anonymous") **conflicts with that documented strategy** — so the plan below treats the gate as the contract and closes the gaps that break even the contract. Only the copy/reconciliation item touches the promise language itself, and only with a Captain decision.

| Gap (from audit) | Contract violation | Verdict |
|---|---|---|
| G1 plan-mode prompt owner-only | Intentional gate | Keep; make promise language explicit (P2 copy) |
| G2 anonymous skips AI prescription → demonstrated fix is plain-English `fix` | "exactly one **complete** fix" — weak proof surface | Fix (P1, no new LLM cost preferred) |
| G3 anonymous retry 403 dead end | Funnel recoverability | **Bug — fix** (P1) |
| G4 anonymous CLI `--wait` calls unregistered `ff_get_report` | CLI docs promise a fix list anon can't get on slow scans | **Bug — fix** (P1) |
| G5 `--plan` CLI no-op flag | Misleading UX | Fix (P2) |
| G6 failed check module silently drops findings | "every Flag" literally false | **Bug — fix** (P1) |
| G7 "Every Flag comes with a fix prompt" (landing) untrue for anon | Copy drift | Fix (P2) |

**Guardrails (do not violate):** anonymous gate stays (one demonstrated prompt; remaining prompts post-claim); no new `/api/audits` routes; no off-by-default feature flags; marketing copy single-source in `lib/marketing/copy.ts`; customer terminology = "update review"; public APIs must not leak gated prompts.

---

## Phase 0 — Decision (Captain, ~15 min)

| Decision | Options | Recommendation |
|---|---|---|
| Anonymous contract for launch | (a) keep gate as documented; (b) ship plan prompt (subset of deterministic fixes) to anon | **(a)** — matches `knowledge/execution.md:31` and the shipped invariant; (b) would be a strategy change, new workstream |
| The one demonstrated fix: AI-quality for free? | (a) deterministic prompt enrichment, no LLM cost; (b) cheap single-flag prescription (real cost per teaser) | **(a)** first; (b) only if dogfood shows (a) is not convincing |
| Failed-module surfacing | (a) persist `failedModules` + report callout; (b) pipeline-log-only (status quo) | **(a)** |

**Done when:** Captain signs off (a)/(a)/(a) or redirects; board rows claimed (one owner per scope).

---

## Phase 1 — Anonymous funnel integrity (P1 bugs)

### 1.1 Anonymous retry dead end
- **Files:** `app/api/reports/[id]/retry/route.ts:25` (403 via `canManageAudit`), `lib/audit/access.ts:22`, `lib/audit/usage.ts` (`ANON_AUDIT_IDS_COOKIE`, `readAnonAuditIds`), `lib/audit/retry-audit.ts`.
- **Change:** allow retry when the audit id is in the requester's `ANON_AUDIT_IDS_COOKIE` (same cookie `claim-anonymous.ts` uses), in addition to owner check. Never widen to "anyone can retry any anon audit".
- **Done when:** unit test: anon cookie holder can retry own failed teaser, 403 otherwise; e2e: anon scan → forced failure → retry succeeds and re-queues.

### 1.2 Anonymous CLI/MCP slow-scan dead end
- **Files:** `lib/mcp/tools/index.ts:20-21`, `lib/mcp/anon-task-tools.ts`, new `lib/mcp/anon-report-tool.ts` (or fold into anon tools), `fixflags-cli/src/workflows.ts:218-239`.
- **Change:** register a read-only `ff_get_report` for anonymous sessions, gated to audits where `userId === null || isPublic` (mirrors `canAccessAudit` in `lib/audit/access.ts`), returning the same `'one'`-prompt fix list `ff_check_and_plan` already returns. CLI `waitForReport` then works anonymously without leaking gated prompts.
- **Done when:** anon `fixflags check <url> --wait` completes on an audit that exceeds the 50 s sync window; report payload identical shape to signed-in but with `'one'` prompt access; no gated prompt in the response (test asserts).

### 1.3 Silent check-module failure
- **Files:** `lib/audit/checks/index.ts:98-100` (catch → `failedModules`), `lib/audit/pipeline/run-page.ts:415-418` (log only), `lib/audit/pipeline/types.ts`, persist layer, `components/audit/AuditReport.tsx` status callouts.
- **Change:** persist `failedModules` on the audit (or derive from pipeline log `check_failed` events) and render a "Some checks could not run — fix list is partial" callout; keep the rubric score penalty. Do not fabricate findings.
- **Done when:** unit test for module-throw → audit row carries module names; render test for callout; existing accuracy corpus unaffected.

---

## Phase 2 — Make the one demonstrated fix agent-ready (P1 quality, no new LLM cost)

- **Files:** `lib/audit/finish-plan.ts` (`resolveFixPrompt` path), `lib/audit/priority-flags.ts`, `lib/audit/flag-copy.ts` (`buildExpertFixPrompt`), `lib/audit/fetch-audit.ts:332` (`sampleFixFlag`), `lib/audit/__tests__/flag-copy.test.ts`.
- **Change:** for the anonymous demonstrated flag only, build the prompt through the same expert-prompt path signed-in users get, fed by the deterministic `fix` + evidence + verification rule (no LLM call). Keeps `'one'` access; upgrades the proof surface from "plain-English fix" to a structured agent-shaped instruction.
- **Done when:** anon report's demonstrated prompt renders as a structured fix prompt; signed-in output unchanged; `flag-copy.test.ts` updated to pin the anon ordering.
- **Explicitly deferred unless Captain picks (b):** per-teaser single-flag prescription (cost). Needs a cost cap decision before any work.

---

## Phase 3 — Hygiene (P2)

### 3.1 `--plan` no-op
- **Files:** `fixflags-cli/src/index.ts:312,324`.
- **Change:** wire `--plan` (toggle: plan-mode prompt vs per-flag list) or remove it. Removing is cheaper and safer; wiring is only worth it if CLI users ask. Default: remove, update CLI README/`package:check`.

### 3.2 Promise-language reconciliation (copy only)
- **Files:** `lib/marketing/copy/landing.ts:33,43,72`, `lib/marketing/copy/auth.ts:294`, `lib/marketing/copy/terminology.ts`, `docs/investigations/launch-promise-audit.md` (status note).
- **Change:** make the plan-mode prompt an explicit post-signup unlock in landing/CLI copy ("every Flag + one fix prompt now; one prompt with all fixes after you create a free account"); soften "Every Flag comes with a fix prompt" for anonymous framing. Keep the promise for signed-in exactly as-is.
- **Done when:** `product:contract-guard` and copy guards green; no banned filler/em dashes.

---

## Phase 4 — Verification & evidence

| Gate | Command |
|---|---|
| Changed-file verification | `npm run agent -- verify --dry-run` → `npm run agent -- verify` |
| Full gate (before merge to `main`) | `npm run verify` |
| CLI pack + tests | `npm run test:cli` (fixflags-cli pack, README, dist-tag) |
| Accuracy untouched | `npm run accuracy:eval` (1.3, 2.x touch checks only) |
| Contract guards | `npm run product:contract-guard`, `npm run routes:contract-guard`, `npm run mcp:quality-gate` |
| E2E anon paths | anon scan → fail → retry (1.1); anon CLI slow audit (1.2); anon demonstrated prompt shape (2.x) |

**Evidence to record:** real anon scan screenshots (report + demonstrated prompt), CLI transcript for a >50 s audit, failed-module callout render, retry 403→200 trace. Update `knowledge/execution.md` and the audit report status if wording changes.

---

## Ownership & coordination

- One owner per scope (1.1, 1.2, 1.3, 2.x, 3.1, 3.2); claim on `.agents/BOARD.md` before starting; no branches/worktrees unless the Captain asks.
- 1.2 and 2.x both touch the anon fix-list read path — sequence them (1.2 first) or same owner.
- Leave `.agents/handoffs/` records for anything incomplete at end of session.

## Definition of done (this plan)

- Anonymous visitor receives: every Flag + evidence, one demonstrated **agent-shaped** fix prompt, working retry, working CLI, and an honest "partial checks" signal when a module fails.
- Signed-in owner receives: unchanged full plan-mode prompt + all fix prompts + recheck diff.
- All gates green; copy/contract guards green; no gated prompt leaks; no strategy change without a Captain decision.
