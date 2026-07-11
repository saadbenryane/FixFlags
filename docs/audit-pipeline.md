# Audit pipeline

Canonical reference for the FixFlags scan pipeline: stages, AI phases, degradation, recovery, and debugging.

## Stage diagram

```
audit job (BullMQ, always):
  QUEUED → CAPTURING → CHECKING → JUDGING (triage) → FINALIZING → COMPLETED

ai-review job (optional, gated):
  prescription LLM → FINALIZING → COMPLETED (sets aiReviewAt)
```

Triage runs **inline in the audit job** for every scan. Prescription runs in a **separate async job** after triage completes.

## AI phases

| Phase | When | Job | Gated by |
|-------|------|-----|----------|
| Deterministic checks | Always | `audit` | — |
| Triage (phase 1) | Primary page only | `audit` | LLM keys + deadline budget |
| Prescription (phase 2) | After triage | `ai-review` | `includeAi` + signed-in + credits |

### `includeAi` vs `triageAt` vs `aiReviewAt`

- **`triageAt`** — phase-1 triage succeeded (score, verdict, rubric grades, AI flag titles).
- **`aiReviewAt`** — phase-2 prescription succeeded (fix prompts, evidence, whyItMatters).
- **`includeAi`** — resolved by `lib/audit/ai-report-entitlement.ts` at audit create time. Controls whether prescription is enqueued after triage, not whether triage runs.

Anonymous visitors: triage runs; fix prompts stripped by `lib/audit/report-access.ts`.

## Degradation matrix

| Trigger | Outcome | User sees |
|---------|---------|-----------|
| Triage succeeds | `COMPLETED`, `triageAt` set | Score, verdict, rubrics |
| Triage fails (keys, timeout, provider) | `COMPLETED`, `triageAt` null, `failureCode` set | Flags + honest degraded verdict |
| Capture fails | `FAILED` | Check failed panel |
| Prescription fails | `COMPLETED`, `triageAt` set, `failureCode` AI_REVIEW_FAILED | Triage report + partial AI callout |
| PageSpeed 429 | PARTIAL completeness | Flags still run; perf data missing |
| R2 missing (prod) | `FAILED` at capture | Scanner unavailable |
| Worker down / stuck | Poll recovery → requeue or FAILED | Clear timeout message |

## Failure codes

Internal codes map to user copy via `lib/audit/user-facing-errors.ts` and `AUDIT_ERRORS` in `lib/marketing/copy.ts`.

| Code | User message theme |
|------|-------------------|
| `AI_PROVIDER_NOT_CONFIGURED` | Scanner temporarily unavailable |
| `AUDIT_TIMEOUT` | Took longer than expected |
| `AI_REVIEW_FAILED` | Partial AI review |
| `DESKTOP_CAPTURE_FAILED` | Could not capture screenshot |

## Recovery

Two paths share `lib/audit/recover-audit-job.ts`:

1. **Poll-time** — every status poll after 15s idle (`recoverAuditJobOnPoll`)
2. **Scheduler** — every ~2 min for audits stuck > `STUCK_AUDIT_MINUTES`

Constants: `AUDIT_DEADLINE_MS` (180s), `POLL_FORCE_FAIL_GRACE_MS` (15s), `WORKER_DOWN_GIVEUP_SECONDS` (180s).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | At least one required for triage |
| `JUDGE_PROVIDER_CHAIN` | Provider fallback order (default `openai,anthropic`) |
| `TRIAGE_MODEL`, `TRIAGE_MAX_TOKENS` | Cheap triage pass tuning |
| `PAGESPEED_API_KEY` | Recommended prod; avoids 429 |
| `R2_*` (five vars) | Required for prod screenshots |
| `AUDIT_DEADLINE_MS` | Hard audit deadline (default 180000) |
| `MIN_JUDGE_BUDGET_MS` | Min time before triage starts (default 25000) |

## Health endpoints

| Endpoint | Checks |
|----------|--------|
| `GET /api/health` | DB, `storageConfigured`, `aiConfigured` |
| `GET /api/health/ai` | Provider keys + triage schema loaded |
| `GET /api/health/browser` | Chromium + R2 connectivity |
| `GET /api/health/worker` | Redis + worker heartbeat |

## Debugging runbook

1. `curl https://fixflags.com/api/health` — confirm `aiConfigured: true`, `storageConfigured: true`
2. Check Railway env: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` on web service (inline worker)
3. Redeploy after setting keys (SDK clients init at module load)
4. Pipeline log events: `triage_step_failed`, `triage_degraded`, `triage_runner_retry`, `recovery_force_failed`
5. Post-deploy: `npm run smoke:triage:prod`

## Canonical files

| File | Role |
|------|------|
| `lib/audit/runner.ts` | Top-level orchestrator |
| `lib/audit/pipeline/run-page.ts` | Per-page capture/checks/triage |
| `lib/audit/pipeline/finalize-from-outcome.ts` | Outcome → finalize routing |
| `lib/audit/pipeline/outcome.ts` | Resolve triage_complete vs degraded |
| `lib/audit/judge-triage.ts` | Triage LLM + retry |
| `lib/audit/judge-prescription.ts` | Prescription LLM |
| `lib/audit/finalize.ts` | Triage / prescription / degraded finalize |
| `lib/audit/run-ai-review.ts` | Phase-2 prescription job |
| `lib/audit/recover-audit-job.ts` | Stuck audit recovery |
| `lib/audit/pipeline-config.ts` | Deadlines and budgets |

## Page text limits

Prescription uses **5000 chars** from `lib/audit/page-text-limits.ts`. Triage uses **2500 chars**. Change both the limits file and `buildPrescriptionPrompt` in `lib/prompts/system-prompt.ts` together.
