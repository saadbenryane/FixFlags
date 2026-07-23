# lib/audit/ - Audit Engine

## Responsibility
Core audit pipeline: browser capture, 22 check modules, AI triage/prescription, scoring, flag persistence, report data shaping.

## Entry Points
| File | Purpose |
|------|---------|
| `runner.ts` | Main audit orchestrator (capture → checks → journey → finalize) |
| `pipeline/run-page.ts` | Per-page capture, slow replay, checks, triage |
| `deterministic-audit.ts` | Offline/demo probe runner (not production) |
| `checks/index.ts` | Barrel for 22 check modules (`checkers[]` array) |
| `persist.ts` | Saves audit results to DB (flags, scores, metadata) |
| `finalize.ts` | Post-check finalization (diff against parent, journey flags, visual evidence) |
| `create-audit.ts` | Creates audit record + enqueues job |
| `fetch-audit.ts` | Loads audit from DB with all relations |

## Key Subsystems

### Browser Capture (`browser/`)
- `page-session.ts` - Playwright page lifecycle (launch, navigate, collect)
- `screenshot.ts` - Screenshot capture + storage (R2 or local)
- `journey-safety.ts` - Form probe safety (payment/download blocking)

### Check Modules (`checks/`)
22 modules, each a `run*Checks()` function. Registered in `checks/index.ts` barrel.
Key modules: metadata, performance, accessibility, SEO, trust, mobile, content, security, visual-polish, messaging-clarity, conversion-friction.

### AI Judge (`judge*.ts`, `prompts/`)
- `judge-triage.ts` - Inline triage (2500 chars pageText, all scans)
- `judge-prescription.ts` - Async prescription (5000 chars, post-signup, gated by credits)
- `judge-config.ts` - Model resolution (OpenAI primary, Anthropic fallback)
- `validate-triage-output.ts` / `validate-judge-output.ts` - Zod schema validation

### Scoring & Flags
- `scoring.ts` - Rubric score calculation (Message, Experience, Reach)
- `rubric.ts` - Rubric definitions
- `check-ids.ts` - 158 fine-grained check IDs
- `priority-flags.ts` - Flag prioritization for Top Priorities section
- `deduplicate.ts` - `suppressOverlappingFlags()` (drops broader flag when specific sibling exists)

### Report Data
- `build-report-shape.ts` - Shapes audit data for report UI
- `flow-data.ts` - Flow/journey data for report
- `product-contract.ts` - Inferred product intent
- `preview-meta.ts` - Screenshot preview metadata
- `launch-readiness.ts` - Launch gate evaluation

### Pipeline Support
- `pipeline-config.ts` - Pipeline version + stage definitions
- `pipeline-errors.ts` - Error classification
- `pipeline-log.ts` - Structured logging
- `stuck-audit-recovery.ts` - Recovery for stalled audits
- `recover-audit-job.ts` - Re-enqueue stuck jobs

## Integration Points
- **Queue:** Enqueued by `lib/queue/client.ts`, processed by `lib/queue/inline-worker.ts` or `worker/index.ts`
- **DB:** Persists via Prisma (`prisma/schema.prisma` models: Audit, AuditFlag, AuditPage, etc.)
- **AI:** Calls OpenAI/Anthropic via `lib/audit/judge-config.ts`
- **Storage:** Screenshots to Cloudflare R2 (`lib/storage/`) or local `.data/screenshots/`
- **Report UI:** Data consumed by `app/report/[id]/page.tsx` → `components/audit/` + `components/report/`

## Invariants
- Pipeline stages: QUEUED → CAPTURING → CHECKING → JUDGING → FINALIZING → COMPLETED
- `includeAi` does NOT gate triage (only prescription)
- Journey flags created with `source: JOURNEY`; `clearAuditResults` preserves them
- Visual evidence capture failures must not fail the audit
- Flag dedup runs via `suppressOverlappingFlags()` in `checks/index.ts`
- `impactTag` set on all deterministic checks
