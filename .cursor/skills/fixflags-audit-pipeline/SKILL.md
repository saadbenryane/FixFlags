---
name: fixflags-audit-pipeline
description: FixFlags audit pipeline — triage, prescription, scan failures, recovery, includeAi. Use when debugging stuck scans, triage failures, graceful degradation, failure codes, or changing pipeline stages. Triggers on audit pipeline, triage, prescription, scan failure, stuck audit, includeAi, failure codes, recover-audit-job.
---

# FixFlags Audit Pipeline

**Read [`AGENTS.md`](../../AGENTS.md) first.** Volatile counts live there only.

**Canonical doc:** [`docs/audit-pipeline.md`](../../docs/audit-pipeline.md)

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
| Triage | `lib/audit/judge-triage.ts`, `pipeline/triage-step.ts` |
| Prescription | `lib/audit/run-ai-review.ts`, `judge-prescription.ts` |
| Finalize | `lib/audit/finalize.ts` |
| Recovery | `lib/audit/recover-audit-job.ts` |
| Failure copy | `lib/audit/user-facing-errors.ts`, `lib/marketing/copy.ts` AUDIT_ERRORS |
| Report access | `lib/audit/report-access.ts`, `fetch-audit.ts` |

## Verification

```bash
npm run test:unit -- lib/audit/__tests__/run-audit.test.ts lib/audit/__tests__/outcome.test.ts
npm run smoke:triage:prod   # post-deploy, requires prod keys
npm run demo:audit:offline  # deterministic checks only
```

## Anti-patterns

- Treating `includeAi: false` as "skip triage" — triage always runs on primary page
- Marking audit FAILED when triage fails but capture succeeded — use `finalizeTriageDegraded`
- Editing offering.md "fix prompts on every report" without checking `report-access.ts`
- Conflating `ai-review` job with triage — it is prescription only

## Prod triage checklist

1. `GET /api/health` → `aiConfigured: true`
2. Railway web service has `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
3. Redeploy after key changes
4. `npm run smoke:triage:prod`
