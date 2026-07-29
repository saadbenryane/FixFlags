---
name: fixflags-audit-pipeline
description: FixFlags audit pipeline — triage, prescription, scan failures, recovery, includeAi. Use when debugging stuck scans, triage failures, graceful degradation, failure codes, or changing pipeline stages. Triggers on audit pipeline, triage, prescription, scan failure, stuck audit, includeAi, failure codes, recover-audit-job.
---

# FixFlags Audit Pipeline

Read `AGENTS.md` first. Generate volatile facts from code and repository commands.

**Canonical doc:** `docs/audit-pipeline.md`
**Report hierarchy:** `knowledge/report-contract.md`. Do not duplicate its order here.

**Product framing:** The audit pipeline is the Integrity Engine's primary **browser observer + verifier**. Customer Product Intelligence is separate (`knowledge/product-intelligence.md`, `knowledge/integrity-engine.md`). Do not treat the scanner as the entire product.

## Decision tree

```
Audit FAILED?
  → capture/infrastructure error. Check failureCode, /api/health/browser

Audit COMPLETED but no score/verdict?
  → triage degraded. Check triageAt, failureCode, /api/health aiConfigured

Audit COMPLETED, score/verdict OK, no fix prompts?
  → prescription not run or failed. Check aiReviewAt, includeAi, aiReviewPending
```

## Before editing

- Triage schema: `lib/audit/judge-triage-schema.ts`
- Prescription schema: `lib/audit/judge-prescription-schema.ts`
- Page text limits: change **both** `lib/audit/page-text-limits.ts` and `lib/prompts/system-prompt.ts`
- `includeAi` gates prescription only, not triage

## Key files

| Area | Files |
|------|-------|
| Orchestrator | `lib/audit/runner.ts` |
| Per-page | `lib/audit/pipeline/run-page.ts` |
| Outcome routing | `lib/audit/pipeline/outcome.ts`, `finalize-from-outcome.ts` |
| Evidence anchors | `lib/audit/persist-evidence-anchors.ts` |
| Visual evidence | `lib/audit/capture/*`, `lib/audit/persist-visual-evidence.ts` (graceful; must not fail audit) |
| Browser | Playwright (`lib/audit/browser/page-session.ts`, `lib/audit/screenshot.ts`) |
| Network / form / overlay | `lib/audit/browser/network-monitor.ts`, `journey-safety.ts`, overlay helpers |
| Action timeline | `lib/audit/action-timeline.ts`, status route, `AuditReportProgressive` |
| Product Contract / PI | `lib/audit/product-contract.ts`, `lib/audit/product-intelligence.ts`, Project `productIntelligence`, Audit `productContract` |
| Triage | `lib/audit/judge-triage.ts`, `pipeline/triage-step.ts` |
| Prescription | `lib/audit/run-ai-review.ts`, `judge-prescription.ts` |
| Finalize | `lib/audit/finalize.ts` |
| Recovery | `lib/audit/recover-audit-job.ts` |
| Preview scan access | `lib/audit/scan-access.ts`, `scan-access-store.ts`, `browser/page-session.ts`; Studio-only API `app/api/projects/[id]/scan-access/route.ts` |
| Finish Plan ranking | `lib/audit/load-finish-plan-flags.ts` (`buildUnifiedFinishPlan`), `finish-plan.ts`; include repo flags for Studio |
| Failure copy | `lib/audit/user-facing-errors.ts`, `lib/marketing/copy.ts` AUDIT_ERRORS |
| Report access | `lib/audit/report-access.ts`, `fetch-audit.ts` |

## Verification

```bash
npm run test:unit -- lib/audit/__tests__/run-audit.test.ts lib/audit/__tests__/outcome.test.ts
npm run accuracy:eval          # offline corpus gate (gold 0 false blockers)
npm run accuracy:probe -- <url> # live HTML adjudication before changing checks
npm run demo:audit:offline     # deterministic demo v1 repair proof
npm run agent -- eval recovery # PostgreSQL + Redis retry/idempotency evaluation
npm run smoke:triage:prod      # post-deploy, requires prod keys
```

**Scan accuracy skill:** `.agents/skills/fixflags-scan-accuracy/SKILL.md` for corpus architecture and adjudication rules.

**Browser capture skill:** `.agents/skills/fixflags-browser-capture/SKILL.md` for Playwright capture, flow, slow replay, journey, and network probes. Do not adopt chrome-devtools-mcp or AXI browser CLIs for production scans.

## Browser capture truth

- Production path: `runner.ts` → `pipeline/run-page.ts` → `captureScreenshots` + `runSlowReplay` (budget permitting).
- Playwright singleton per worker; each operation uses an isolated browser context closed on exit.
- `deterministic-audit.ts` is offline/demo only.
- AXI applies to agent-facing CLI/MCP (`fixflags-cli/`, `scripts/project-agent.mjs`), not audit capture.

## Anti-patterns

- Replacing Playwright capture with chrome-devtools-mcp, chrome-devtools-axi, or conversational browser agents
- Treating `includeAi: false` as "skip triage" — triage always runs on primary page
- Marking audit FAILED when triage fails but capture succeeded — use `finalizeTriageDegraded`
- Editing offering.md "fix prompts on every report" without checking `report-access.ts`
- Conflating `ai-review` job with triage — it is prescription only
- Emitting both `hierarchy-too-many-fonts` and `visual-typography-sprawl` without a `suppressOverlappingFlags` pair (same `uniqueFontFamilies > 4` signal)
- Leaving AI-only capability rows as `partial` with empty `checkIds` — fold into `ai-rubric-pass` or add deterministic checks; run `npm run audit:capabilities` and update AGENTS.md
- Claiming Truth Done without dogfood / form-ratio / score edge tests when QUALITY marks them CRITICAL

## Flag quality before ship

- Form-validation severity uses 50% missing ratio (`IMPORTANT` ≥ 0.5, else `POLISH`) — keep the unit test in `checks.test.ts`
- All-CRITICAL score fixtures must drive MESSAGE/EXPERIENCE toward floor
- Prefer narrowing FP heuristics over widening severity

## Journey + visual evidence + functional probes

- Journey templates run in `runner.ts` **before** `finalizeFromOutcome`, writing `Flag` rows with `source: JOURNEY`.
- `clearAuditResults` / `persistTriageResults` must only clear `DETERMINISTIC` + `AI` (preserve JOURNEY).
- Visual evidence: filter severities `CRITICAL` | `IMPORTANT`; persist to `performanceData.flagVisualEvidence`; wire via report page → `AuditReport` → `buildLiveExplorerModel({ flagVisualEvidence })`.
- **Network monitor:** `page.on('response')` in page-session / journey / flow collects same-origin xhr/fetch failures into `performanceData.networkFailures`. Cap list size. Ignore ad/tracker hosts unless they block first-party UX.
- **Form probe:** Payment hosts stay aborted. Same-origin engagement POST may `route.fetch` once, record status, then fulfill/abort. Synthetic email: `fixflags-probe+{auditId}@example.com`. Never probe Stripe/PayPal/etc.
- **Overlay probe:** On click failure, `elementFromPoint` + covering element metadata → `overlay-blocks-nav|cta|form` Flags (prefer over generic unclickable when overlay identified).
- **Action timeline:** Append `{t, kind, label, url?, status?}` during capture/flow/**and journey**; merge into `performanceData.actionTimeline` after journeys; stream on status API; render in `AuditReportProgressive` + completed `AuditReport`. Completed report page **must** pass `actionTimeline` from `fetch-audit`. Not a chat agent.
- **Anti-FP:** Shared filter suppresses content Flags whose problem/evidence match tooling paths (`playwright-mcp`, `/tmp/`, `.yml` session dumps).
- **Form silent failure:** `form-submit-silent-failure` when probe/submit gets 2xx but no success UI (or UI success with failed upstream).
- **Report wiring:** the server assembler passes focused summary/Finish Plan/access data separately from detailed Contract/timeline/explorer data. Preserve flag `source` for evidence truth.
- **Finish Plan:** always rank through `buildUnifiedFinishPlan` (live flags + Studio repo findings). Do not rebuild ad hoc in MCP, export, or report UI.
- **Scan access:** thread `scanAccess` through Playwright (`createAuditPage`), fetch helpers (`scanAccessToFetchHeaders`), journey, flow, critical-path discovery, and visual capture side-by-side pages.

## Competitive boundary

Do **not** add Scout-style conversational "check anything else" chat on the audit path. Depth comes from Product Contract, network/overlay probes, ranked Flags, and re-check proof.

## Prod triage / deploy checklist

1. `docker build` green if Dockerfile/package*.json changed
2. `GET /api/health` → `aiConfigured: true`
3. `GET /api/health/browser` after deploy (Chromium + R2)
4. Railway web service has `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
5. Redeploy after key changes
6. `npm run smoke:triage:prod`
7. `npm run verify:release` with disposable database reset authorization, container environment, and deployed smoke credentials; required checks may not be skipped
