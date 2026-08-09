# Launch Promise Audit — "Paste a URL → get ONE prompt with ALL the fixes"

- **Date:** 2025 (read-only investigation; no files modified)
- **Scope:** end-to-end trace of the anonymous scan funnel (web + CLI/MCP), the Finish Plan / plan-mode prompt, degrade paths, flag completeness, and the recheck loop.
- **Verdict:** the core promise holds **for a signed-in / claimed owner after the AI prescription phase**, and does **not** hold for the anonymous visitor who is the primary marketing funnel. The anonymous teaser delivers *every flag with evidence* but **one single-flag demonstrated fix prompt** — never the "ONE prompt with ALL the fixes" plan-mode prompt — and those flags carry no AI-crafted prompts at all because the prescription phase is skipped entirely for anonymous audits.

---

## Executive verdict

The product machinery is real and works end-to-end: capture → 22 deterministic check modules → AI triage → AI prescription → ranked Finish Plan → plan-mode prompt → recheck diff. But the **anonymous teaser — the first and most important surface in the funnel — intentionally and by design stops short of the promise**:

1. **Anonymous audits never run the AI prescription phase.** `resolveIncludeAiForNewAudit(null)` returns `false` (`lib/audit/ai-report-entitlement.ts:15`), so `includeAi=false` at creation (`lib/audit/create-audit.ts:160`). Triage runs (an LLM call is spent on the teaser), but no `agentPrompt`/`cursorPrompt`/… are ever generated, and `run-ai-review.ts:34` explicitly refuses prescription without a `userId`.
2. **Anonymous users cannot receive the plan-mode prompt.** `checkAndPlan` passes `promptAccess: 'one'` for anonymous callers (`lib/audit/task-contracts.ts:381-382`), and `copyPrompt` (the "one prompt with all fixes") is only built when `promptAccess === 'all'` (`lib/audit/finish-plan.ts:121`). Every read path (web API, report page, MCP, CLI) resolves `'all'` only for the owner.
3. **The one demonstrated prompt is a downgrade.** Because prescription never ran, the demonstrated prompt falls back to the deterministic module's plain-English `fix` string (`resolveFixPrompt` candidates in `lib/audit/priority-flags.ts`), not the AI-crafted agent prompt the marketing copy promises ("Writes fix prompts your agent runs", `lib/marketing/copy/landing.ts:72`). AI-triage flags in the anonymous report have **no prompt at all**.
4. **Anonymous failure recovery is a dead end.** The failure UI shows a retry button for everyone, but the retry API 403s for anonymous audits (`canManageAudit` requires `userId`, `lib/audit/access.ts:22`; enforced at `app/api/reports/[id]/retry/route.ts:25`).
5. **The anonymous CLI/MCP path is half-broken**: it works only if the check completes inside the server's 50 s synchronous window; on slower audits the CLI's `waitForReport` calls `ff_get_report`, which is **not registered for anonymous** (`lib/mcp/tools/index.ts:20-21`), so the CLI dies with an "unknown tool" error instead of a useful fix list.

This finding was superseded by the Agent-led report contract. Anonymous visitors now receive all confirmed Flags and evidence, while every fix prompt requires authentication. The canonical behavior lives in `knowledge/report-contract.md`.

---

## Promise gap table

| # | Gap | Evidence (file:line) | Funnel impact |
|---|-----|----------------------|---------------|
| G1 | Anonymous gets **one single-flag prompt**, not the plan-mode prompt with all fixes | `lib/audit/task-contracts.ts:381-382` (`anon ? 'one' : undefined`); `lib/audit/finish-plan.ts:121` (`copyPrompt` only when `promptAccess === 'all'`); `lib/audit/finish-plan.ts:85-89` (single demonstrated item gets `prompt`) | The headline value prop is invisible pre-signup; the teaser shows "Top fixes" with one flag's prompt and a signup CTA |
| G2 | Anonymous audits **never run AI prescription** — no agent-ready prompts exist for them | `lib/audit/ai-report-entitlement.ts:15` (`if (!userId) return false`); `lib/audit/create-audit.ts:160`; `lib/audit/run-ai-review.ts:34` ("must be claimed before prescription") | Even the demonstrated prompt is plain-English `fix`; AI-triage flags are promptless; "fix prompts your agent runs" (landing.ts:72) is only true post-signup |
| G3 | Anonymous **retry dead end** on failed scans | `components/audit/AuditPageClient.tsx:282` (retry button always rendered); `lib/audit/access.ts:22` (`if (!audit.userId) return false`); `app/api/reports/[id]/retry/route.ts:25` (403) | Failed anonymous scan → retry 403s → user must paste a new URL and burn another anonymous scan |
| G4 | Anonymous **CLI/MCP path incomplete and fragile** | `lib/mcp/tools/index.ts:20-21` (anon registers only `ff_check_and_plan` + `ff_get_check_status`); `fixflags-cli/src/workflows.ts:224` (`waitForReport` calls `ff_get_report` → not registered for anon → error) | Slow scans (>50 s) dead-end anonymous CLI runs; `fixflags check <url>` docs imply a full fix list that anon cannot get |
| G5 | `--plan` CLI flag is a **declared no-op** | `fixflags-cli/src/index.ts:312` (option defined, default true, never read in the action body) | Misleading UX; no way to toggle; full list is always printed (works only when signed in anyway) |
| G6 | **Silent completeness loss** when a check module fails | `lib/audit/checks/index.ts:98-100` (module error caught, only `failedModules.push(name)` + pipeline log; findings dropped); no user-visible indicator | "ALL the fixes" quietly loses an entire check area (e.g. axe, layout) with no warning in the report |
| G7 | Anonymous fix list shows all flags but **no per-flag prompts** beyond the demonstrated one (by design, but copies "Every Flag comes with a fix prompt", landing.ts:43) | `lib/audit/report-access.ts` `stripDeterministicFixesFromFlags` (all six prompt fields + `fix` → null); `lib/audit/fetch-audit.ts:332` `sampleFixFlag` | Design-intentional gating, but the landing promise wording invites the mismatch |
| G8 | **Recheck is signed-in-only** (by design) | `lib/audit/create-audit.ts` `assertParentAuditAllowed` requires `userId`; CLI `recheck` requires credential (`fixflags-cli/src/index.ts:420`) | Not a regression — recheck is delivered for signed-in users (see below) |

---

## Anonymous vs signed-in comparison (what each user actually receives)

Pipeline stages: `POST /api/checks` → queue → Playwright capture → 22 deterministic checks → AI triage → AI prescription → finish-plan/plan-mode prompt → report UI + CLI.

| Stage | Anonymous (userId null) | Signed-in owner (within quota) |
|---|---|---|
| Capture + 22 checks | ✅ runs | ✅ runs |
| AI triage (verdict, rubrics, AI flags) | ✅ **runs** (LLM cost spent; `lib/audit/pipeline/run-page.ts:502` has no `includeAi` gate) | ✅ runs |
| AI prescription (agent prompts) | ❌ **never** (`includeAi=false`; claim required) | ✅ runs (enqueued at finalize; `lib/audit/pipeline/finalize-from-outcome.ts:136-139`) |
| Verdict + rubric summaries | ✅ visible (triage-based) | ✅ visible |
| All flags with problem + evidence | ✅ visible | ✅ visible |
| Fix prompts per flag | ❌ stripped (`stripDeterministicFixesFromFlags`) | ✅ all (agentPrompt first) |
| One demonstrated fix prompt | ✅ single flag, plain-English `fix` fallback | n/a (unlocks everything) |
| **Plan-mode prompt ("ONE prompt with ALL the fixes")** | ❌ **never built** (`copyPrompt` gated to `'all'`) | ✅ `fixList.planPrompt` + "Copy top fixes" (`ReportPolishPass`) + `ff_plan_mode_prompt` |
| MCP tools (`ff_get_all_fixes`, `ff_plan_mode_prompt`, `ff_get_report`, `ff_recheck_and_compare`) | ❌ not registered (`lib/mcp/tools/index.ts:20-21`) | ✅ registered (`:24-26`) |
| Recheck / Fixed-Remaining-New-Regressed | ❌ sign-in required | ✅ `ff_recheck_and_compare` → `getFlagDiffSummary` |
| Retry a failed scan | ❌ 403 dead end | ✅ owner retry |

**Post-signup unlock path works:** claim at `/api/me/claim` (wired from `app/(auth)/post-login/page.tsx:30`) sets `includeAi=true` and enqueues prescription; owner then sees the full plan prompt. But this is *after* the conversion moment — the funnel's anonymous visitor never experiences the promise.

---

## Degrade-path findings

| Failure | Behavior | Verdict |
|---|---|---|
| Triage LLM failure / deadline | Degrades to COMPLETED with deterministic flags only (`lib/audit/pipeline/outcome.ts` `triage_degraded`; `finalize-from-outcome.ts` `finalizeTriageDegraded`); report shows `TriageUnavailableCallout`; verdict absent | ✅ Good — user still gets a deterministic fix list |
| AI prescription failure (signed-in) | `AI_REVIEW_FAILED`/`AI_CONTRACT_INVALID`, status COMPLETED, warning callout (`lib/audit/run-ai-review.ts:141-155`); deterministic `fix` fallbacks remain | ✅ Good |
| Pipeline error after capture evidence exists | `tryPartialFinalize` → partial COMPLETED report with deterministic flags (`lib/audit/pipeline/context.ts:49-84`) | ✅ Good |
| Full capture failure (no evidence) | Status FAILED + failure code + `AuditFailurePanel` with retry | ⚠️ Retry 403s for anonymous (G3) — dead end for the primary funnel visitor |
| Individual check module throws | Flags silently dropped; `failedModules` only in pipeline log + rubric score penalty (`lib/audit/checks/index.ts:98-100`; `lib/audit/checks/rubric-scoring.ts:62-79`) | ⚠️ Silent completeness loss (G6) — no user-facing warning that "all fixes" is partial |
| Retry of failed/completed audit | `retryAudit` re-queues with fresh capture (`lib/audit/retry-audit.ts`) | ✅ Works for owners |

**Degrade summary:** the pipeline is strongly engineered to never leave a user with nothing — except the anonymous retry dead end, and the silent per-module finding loss.

---

## Completeness findings

- **All 22 deterministic modules flow into the fix list.** Registered in `lib/audit/checks/index.ts` (bucket A 14, B 3, C 5 = 22); flags persisted at triage finalize (`persistTriageResults`) or partial finalize; corridor-consistency, journey, flow, network-engagement, and search-performance (GSC, signed-in) flags are merged into the same plan (`lib/audit/pipeline/finalize-from-outcome.ts` `persistEvidenceAnchors`; `lib/audit/runner.ts`).
- **The fix list is the full flag set** minus `FIXED`/`IGNORED` (`finish-plan.ts` `unresolvedFlags`), consolidated by check base-id across pages (`lib/audit/consolidate-flags.ts`), ranked by priority/contract alignment (`lib/audit/priority-flags.ts`), and (for signed-in Studio) augmented with repo findings (`lib/audit/load-finish-plan-flags.ts` → `loadRepoFlagsForAudit`).
- **Intentional suppression exists** (overlapping-flag and page-role suppression, `lib/audit/suppression.ts`; tooling-path noise filter) — deliberate quality decisions, not silent drops.
- **Gaps in completeness:**
  - Failed modules drop their findings with no user-facing indicator (G6).
  - AI-triage flags appear in the anonymous fix list with **zero prompt** until prescription runs (G2).
  - Dedup is by checkId per page (`checks/index.ts` `seen` set) — a module emitting duplicate checkIds across code paths collapses to one finding; acceptable, but worth knowing.
  - `fix` fallback guarantees deterministic flags always have *a* prompt candidate, so `buildPlanModePrompt` rarely returns empty — but flags whose only candidate is `fix` are plain-English, not agent-ready.

---

## Recheck / product-watch path (item 5 of the brief)

**Delivered.** `getFlagDiffSummary` (`lib/audit/diff-flags.ts:157-252`) computes Fixed / Remaining / New / Regressed from check-id–keyed (or AI-problem–keyed) matches; manual recheck always does a fresh full capture (`lib/audit/runner.ts` "Always fresh capture, including parented re-checks") and diffs against the parent (`task-contracts.ts` `recheckAndCompare` → `diff` with `fixed/remaining/newIssues/regressed`). Surfaced as:
- Web: `RecheckDiffStrip` + `RecheckCompletedTracker` (`components/audit/AuditReport.tsx`).
- CLI: `fixflags recheck <reportId> --diff` prints Fixed/Remaining/New/Regressed (`fixflags-cli/src/index.ts`).
- MCP: `ff_recheck_and_compare` (signed-in only).
- Watch notifications on regressions: `diffFlagsAgainstParent` → `notifyWatchRegression` (`lib/audit/project-watch.ts`).

Caveat: recheck requires sign-in (assertParentAuditAllowed) — consistent with the gating model, not a regression.

---

## Prioritized fixes

### P0 — deliver the promise to the funnel (decision required, not just code)

1. **Decide the anonymous contract.** Either (a) ship the plan-mode prompt to anonymous visitors for a *subset* of fixes (e.g. deterministic `fix` texts — no AI cost) so the teaser genuinely shows "one prompt with all fixes", or (b) change the funnel copy to promise "every flag + one demonstrated fix prompt" and make the plan-mode prompt an explicit post-signup unlock. Current state is promise-vs-copy mismatch.
   - Files: `lib/audit/task-contracts.ts:381-382`, `lib/audit/finish-plan.ts:121`, `lib/audit/fetch-audit.ts:332-340`, `app/api/reports/[id]/route.ts:32-39`, `lib/marketing/copy/landing.ts:33,43,72`, `lib/marketing/copy/auth.ts:294`.

### P1 — fix funnel dead ends and silent losses

2. **Anonymous retry dead end.** Allow anonymous users to retry *their own* failed teaser (cookie-scoped audit ids already exist via `ANON_AUDIT_IDS_COOKIE`) in `app/api/reports/[id]/retry/route.ts` / `lib/audit/access.ts:22` — gate on the anon-audit cookie rather than `userId`.
3. **Anonymous prescription skip downgrades the demonstrated prompt.** If the plan is to keep prescription gated, consider writing deterministic check modules' `fix` text through `buildExpertFixPrompt` (`lib/audit/flag-copy.ts`) for the demonstrated flag so the one visible prompt is at least agent-shaped; or run a *cheap* prescription for the single demonstrated flag on anonymous audits.
4. **Survive slow scans in the anonymous CLI.** Register `ff_get_report` (or a read-only anon variant) for anonymous users, or make the CLI wait loop self-contained (`fixflags-cli/src/workflows.ts:224`). Currently anon CLI dies on audits >50 s.
5. **Surface failed check modules.** Persist `failedModules` on the audit and render a "some checks could not run" callout (`lib/audit/checks/index.ts:98-100` → new column or pipeline-log-derived state → `AuditReport.tsx` status callouts), so "all fixes" never silently lies.

### P2 — hygiene

6. **Remove or implement `--plan`.** `fixflags-cli/src/index.ts:312` defines `--plan` with default `true` and never reads it. Either wire it (e.g. toggle plan prompt vs per-flag prompts) or delete it.
7. **Align landing copy** with whatever anonymous contract is chosen (P0) — `landing.ts:43` "Every Flag comes with a fix prompt" is only true for owners.

---

## Evidence index (most important lines)

- `lib/audit/task-contracts.ts:381-382` — anonymous → `promptAccess: 'one'`
- `lib/audit/finish-plan.ts:85-89,121` — single demonstrated prompt; `copyPrompt` only for `'all'`
- `lib/audit/ai-report-entitlement.ts:15` — `if (!userId) return false` (no AI for anon)
- `lib/audit/run-ai-review.ts:34` — prescription requires claim
- `lib/audit/pipeline/run-page.ts:502` — triage runs regardless of `includeAi` (anon LLM cost)
- `lib/audit/report-access.ts` `stripDeterministicFixesFromFlags` / `findHighestSeverityFlagWithFix:160` — anon prompt stripping + demonstrated flag
- `lib/audit/fetch-audit.ts:202,332` — `showDeterministicFixes`, `sampleFixFlag`
- `app/api/reports/[id]/route.ts:32-39` — web `promptAccess` mapping
- `lib/mcp/tools/index.ts:20-26` — anon vs signed-in tool registry
- `lib/mcp/tools/flags.ts` — `ff_plan_mode_prompt` / `ff_get_all_fixes` (signed-in only)
- `fixflags-cli/src/workflows.ts:218-239` — wait loop calls `ff_get_report` (missing for anon)
- `fixflags-cli/src/index.ts:312,420` — `--plan` no-op; recheck auth gate
- `lib/audit/checks/index.ts:98-100` — silent module-failure drop
- `lib/audit/access.ts:22` + `app/api/reports/[id]/retry/route.ts:25` — anonymous retry 403
- `lib/audit/diff-flags.ts:157-252` — recheck Fixed/Remaining/New/Regressed (delivered)
