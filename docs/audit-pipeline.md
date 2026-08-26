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

An Audit is an immutable Review observation of the Product at a moment in time ([knowledge/vision.md](../knowledge/vision.md)).

A Flag is a finding from one Review.

Overlay rectangles live on `Flag.evidenceTargets`. They are harvested on the capture page immediately after the viewport screenshot. Finalize must not re-open the URL to guess a box.

A Product-scoped Improvement is the durable judgment and action object across Reviews.

Product Signals and integrations add evidence; they do not become Flags or confirmed claims automatically.

## Audit modes and review depth

| Mode          | Enum            | Behavior |
| ------------- | --------------- | -------- |
| Single URL    | `SINGLE`        | Anonymous teaser. Fully review the pasted page only. Open-check unique eligible public destinations. Reduced pipeline (no slow-3G, no journey templates). |
| Critical path | `CRITICAL_PATH` | Signed-in default. Stored `reviewDepth` on the Audit decides how far full judgment goes. |

`reviewDepth` is stored at create time from the owner's plan (`lib/billing/plans.ts` `reviewDepthForPlan`). Update reviews and Watch copy that stored value.

| Depth | Plan | Fully review | Open-check |
| ----- | ---- | ------------ | ---------- |
| 1 | Anonymous teaser and Free | The pasted page | Every unique eligible public destination that page exposes |
| 2 | Pro | The pasted page and eligible public pages it links to | Pasted-page destinations only |
| 3 | Studio | Pasted page, linked pages, and one level beyond | Pasted page and those linked pages |

Eligible destination: same-origin `http(s)` HTML navigation. Canonical identity (`lib/audit/url-identity.ts`) collapses hashes, trailing slashes, tracking params, locale/pagination/host variants, and duplicate URLs. Open-check (`lib/audit/open-check.ts`) uses GET/render as authority; HEAD is optional. Dead-destination Flags require evidence. Importance order (`lib/audit/review-depth.ts`) ranks pages before expensive review. Every reviewed page runs the same judgment, including triage. Product score comes from Flags, not page averages. Repeated issues collapse via `affectedPaths[]`.

If allowed depth cannot finish inside the deadline and internal ceilings, the Review is `PARTIAL`. Never silently drop eligible pages and call it complete.

Default for new signed-in audits: `CRITICAL_PATH` unless the client passes `mode: single` (`app/api/checks/route.ts`, MCP `fixflags_audit`).

## Report completeness (`FULL` vs `PARTIAL`)

`reportCompleteness` on the audit and `completeness` on each `AuditPage` reflect missing evidence, not scan failure:

| Condition                                                                  | Completeness                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Desktop screenshot + metadata + both PageSpeed results + mobile screenshot | `FULL`                                                               |
| PageSpeed 429 or partial capture                                           | `PARTIAL` — flags still run; perf data or screenshots may be missing |
| Triage degraded (no LLM)                                                   | `PARTIAL` — deterministic flags + honest degraded verdict            |
| Rubric dimension missing score on any page                                 | Rubric `assessmentState: PARTIAL`, score `null`                      |

Users still get a usable report on `PARTIAL`; UI should not treat it as a failed scan.

## Re-check (post-change FULL path)

Manual re-check is the core loop habit. Implementation invariants:

1. **Always `monitoringMode: FULL`** — `startMonitoringAudit` in `lib/audit/monitoring.ts` always enqueues FULL. App code never writes `SUMMARY_ONLY` (legacy Prisma enum value only).
2. **Fresh capture** — `runAudit` deletes prior screenshots and audit pages, then re-captures from live URL (including parented re-checks). There is no skipCapture / copy-parent path.
3. **Shared credit pool** — manual update Reviews and completed scheduled Reviews consume one Product Review credit.
4. **One active manual Review per Product** — manual creation takes a Product-scoped PostgreSQL transaction advisory lock before checking for an active Review. Concurrent first or update requests reuse the persisted active Review, create no second queue job, and consume no second credit. Watch runs are classified separately and do not block the manual Review.
5. **Persisted parent is authoritative** — the creation result returns the active or newly created Review's stored `parentId`. Re-check comparison and verification consume only that returned parent, never the caller's requested parent. A conflicting request resumes the active Review without fabricating a comparison.
6. **Flag diff after durable completion** — when `audit.parentId` is set, the idempotent completion projection calls `diffFlagsAgainstParent` (`lib/audit/diff-flags.ts`) to mark child flags FIXED / REGRESSED / NEW vs the parent report.
7. **Improvement verification** — the completion projection reconciles pending Improvement Attempts only when the Review is a fresh child of the attempted Review and the applicable page, evidence, and verifier completed comparably.
8. **Inconclusive evidence is honest** — missing, partial, degraded, failed, or non-comparable verifier evidence records `INCONCLUSIVE`, leaves the Improvement unverified, and never writes Product Memory.
9. **Verified learning** — Product Memory receives a learned fact only for an `IMPROVED` attempt with comparable before/after Review evidence and provenance.

Screenshot base64 for prescription is loaded via `loadAuditScreenshotBase64` from the **current** audit's stored screenshots (`lib/audit/load-screenshot-base64.ts`).

## AI phases

| Phase                  | When              | Job         | Gated by                          |
| ---------------------- | ----------------- | ----------- | --------------------------------- |
| Deterministic checks   | Always            | `audit`     | —                                 |
| Triage (phase 1)       | Primary page only | `audit`     | LLM keys + deadline budget        |
| Prescription (phase 2) | After triage      | `ai-review` | `includeAi` + signed-in + credits |

### `includeAi` vs `triageAt` vs `aiReviewAt`

- **`triageAt`** — phase-1 triage succeeded (score, verdict, rubric grades, AI flag titles).
- **`aiReviewAt`** — phase-2 prescription succeeded (fix prompts, evidence, whyItMatters).
- **`includeAi`** — resolved by `lib/audit/ai-report-entitlement.ts` at audit create time. Controls whether prescription is enqueued after triage, not whether triage runs.

Anonymous visitors: triage runs; fix prompts stripped by `lib/audit/report-access.ts`.

## Degradation matrix

| Trigger                                | Outcome                                                     | User sees                          |
| -------------------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| Triage succeeds                        | `COMPLETED`, `triageAt` set                                 | Score, verdict, rubrics            |
| Triage fails (keys, timeout, provider) | `COMPLETED`, `triageAt` null, `failureCode` set             | Flags + honest degraded verdict    |
| Capture fails                          | `FAILED`                                                    | Check failed panel                 |
| Prescription fails                     | `COMPLETED`, `triageAt` set, `failureCode` AI_REVIEW_FAILED | Triage report + partial AI callout |
| PageSpeed 429                          | PARTIAL completeness                                        | Flags still run; perf data missing |
| R2 missing (prod)                      | `FAILED` at capture                                         | Scanner unavailable                |
| Worker down / stuck                    | Poll recovery → requeue or FAILED                           | Clear timeout message              |

## Failure codes

Internal codes map to user copy via `lib/audit/user-facing-errors.ts` and `AUDIT_ERRORS` in `lib/marketing/copy.ts`.

| Code                         | User message theme              |
| ---------------------------- | ------------------------------- |
| `AI_PROVIDER_NOT_CONFIGURED` | Scanner temporarily unavailable |
| `AUDIT_TIMEOUT`              | Took longer than expected       |
| `AI_REVIEW_FAILED`           | Partial AI review               |
| `DESKTOP_CAPTURE_FAILED`     | Could not capture screenshot    |

## Recovery

Two paths share `lib/audit/recover-audit-job.ts`:

1. **Poll-time** — every status poll after 15s idle (`recoverAuditJobOnPoll`)
2. **Scheduler** — every ~2 min for audits stuck > `STUCK_AUDIT_MINUTES`

Constants: `AUDIT_DEADLINE_MS` (180s), `POLL_FORCE_FAIL_GRACE_MS` (15s), `WORKER_DOWN_GIVEUP_SECONDS` (180s).

## Environment variables

| Variable                               | Purpose                                              |
| -------------------------------------- | ---------------------------------------------------- |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | At least one required for triage                     |
| `JUDGE_PROVIDER_CHAIN`                 | Provider fallback order (default `openai,anthropic`) |
| `TRIAGE_MODEL`, `TRIAGE_MAX_TOKENS`    | Cheap triage pass tuning                             |
| `PAGESPEED_API_KEY`                    | Recommended prod; avoids 429                         |
| `R2_*` (five vars)                     | Required for prod screenshots                        |
| `AUDIT_DEADLINE_MS`                    | Hard audit deadline (default 180000)                 |
| `MIN_JUDGE_BUDGET_MS`                  | Min time before triage starts (default 25000)        |

## Health endpoints

| Endpoint                  | Checks                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/health`         | DB, `storageConfigured`, `aiConfigured`                                                                                                                      |
| `GET /api/health/ready`   | Strict database, Redis, worker, Chromium, R2, AI, PageSpeed, auth, billing, email, and Product Watch readiness; returns 503 on any missing launch capability |
| `GET /api/health/ai`      | Provider keys + triage schema loaded                                                                                                                         |
| `GET /api/health/browser` | Chromium + R2 connectivity                                                                                                                                   |
| `GET /api/health/worker`  | Redis + worker heartbeat                                                                                                                                     |

## Debugging runbook

1. `curl https://fixflags.com/api/health/ready` — confirm `ok: true`
2. Check Railway worker env: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` on the dedicated worker service
3. Redeploy after setting keys (SDK clients init at module load)
4. Pipeline log events: `triage_step_failed`, `triage_degraded`, `triage_runner_retry`, `recovery_force_failed`
5. Post-deploy: `npm run smoke:triage:prod`

## Canonical files

| File                                          | Role                                      |
| --------------------------------------------- | ----------------------------------------- |
| `lib/audit/runner.ts`                         | Top-level orchestrator                    |
| `lib/audit/pipeline/run-page.ts`              | Per-page capture/checks/triage            |
| `lib/audit/pipeline/finalize-from-outcome.ts` | Outcome → finalize routing                |
| `lib/audit/pipeline/outcome.ts`               | Resolve triage_complete vs degraded       |
| `lib/audit/judge-triage.ts`                   | Triage LLM + retry                        |
| `lib/audit/judge-prescription.ts`             | Prescription LLM                          |
| `lib/audit/finalize.ts`                       | Triage / prescription / degraded finalize |
| `lib/audit/run-ai-review.ts`                  | Phase-2 prescription job                  |
| `lib/audit/recover-audit-job.ts`              | Stuck audit recovery                      |
| `lib/audit/pipeline-config.ts`                | Deadlines and budgets                     |

## Browser capture (production)

Production scans use **Playwright + Chromium** only (`lib/audit/screenshot.ts`, `lib/audit/browser/page-session.ts`). Do not use chrome-devtools-mcp, chrome-devtools-axi, or conversational browser agents on the audit path.

| Step                         | Where                        | Notes                                                                                                                                                               |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop + mobile screenshots | `captureScreenshots`         | Parallel pages; desktop required                                                                                                                                    |
| CTA flow scan                | Primary page desktop session | `runFlowScan`; failures → `skipped`                                                                                                                                 |
| Slow 3G replay               | `pipeline/run-page.ts`       | `runSlowReplay` when deadline budget > 30s                                                                                                                          |
| Network engagement           | Desktop + mobile sessions    | Merged `networkFailures`; `journeySafe` on flow capture                                                                                                             |
| Technology profile           | Primary desktop session      | Up to 300 deduplicated public resources plus allowlisted document headers and runtime markers; no extra navigation, bodies, cookies, queries, or authorization data |
| Journey templates            | `runner.ts` (Pro+)           | Inline before finalize; not a separate queue job                                                                                                                    |
| Visual evidence              | `finalize-from-outcome.ts`   | Graceful; must not fail audit                                                                                                                                       |

`lib/audit/deterministic-audit.ts` is an **offline/demo probe** (accuracy scripts, flow demos). It is not the production entry point.

Technology detection is versioned and deterministic in `lib/audit/tech-detect.ts`. Audit-owned normalized observations preserve the exact profile shown on the signed-in Product detail page. Only a complete latest audit may reconcile the knowledge graph’s current stack; partial captures never infer removals. Update-review stack changes are shown only when parent and child used the same detector version.

## Page text limits

Prescription uses **5000 chars** from `lib/audit/page-text-limits.ts`. Triage uses **2500 chars**. Change both the limits file and `buildPrescriptionPrompt` in `lib/prompts/system-prompt.ts` together.
