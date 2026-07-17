# FixFlags Audit Pipeline

**Read `AGENTS.md` first.** Canonical doc: `docs/audit-pipeline.md`

## Pipeline stages

```
QUEUED -> CAPTURING -> CHECKING -> JUDGING -> FINALIZING -> COMPLETED
                                                  |
                                            [failure -> FAILED]
```

## Two-phase AI

1. **Triage** (inline in audit job): cheap, sets `triageAt`. 2500 chars pageText.
2. **Prescription** (async `ai-review` job): expensive, gated by `includeAi` + credits. 5000 chars pageText.

`includeAi` does NOT skip triage -- it only controls prescription enqueue.

## Decision tree

```
Audit FAILED?
  -> capture/infrastructure error. Check failureCode, /api/health/browser

Audit COMPLETED but no score/verdict?
  -> triage degraded. Check triageAt, failureCode, /api/health aiConfigured

Audit COMPLETED, score/verdict OK, no fix prompts?
  -> prescription not run or failed. Check aiReviewAt, includeAi, aiReviewPending
```

## Key files

| Area | Files |
|------|-------|
| Orchestrator | `lib/audit/runner.ts` |
| Per-page | `lib/audit/pipeline/run-page.ts` |
| Triage | `lib/audit/judge-triage.ts`, `pipeline/triage-step.ts` |
| Prescription | `lib/audit/run-ai-review.ts`, `judge-prescription.ts` |
| Finalize | `lib/audit/finalize.ts` |
| Recovery | `lib/audit/recover-audit-job.ts` |
| Prompts | `lib/prompts/system-prompt.ts` |
| Page text limits | `lib/audit/page-text-limits.ts` |

## Before editing

- Triage schema: `lib/audit/judge-triage-schema.ts`
- Prescription schema: `lib/audit/judge-prescription-schema.ts`
- If increasing AI pageText, change BOTH `lib/audit/page-text-limits.ts` AND `lib/prompts/system-prompt.ts`
- `includeAi` gates prescription only, not triage

## Verification

```bash
npm run test:unit -- lib/audit/__tests__/
npm run demo:audit:offline  # deterministic checks only
```

## Anti-patterns

- Treating `includeAi: false` as "skip triage" -- triage always runs on primary page
- Marking audit FAILED when triage fails but capture succeeded -- use `finalizeTriageDegraded`
- Conflating `ai-review` job with triage -- it is prescription only
