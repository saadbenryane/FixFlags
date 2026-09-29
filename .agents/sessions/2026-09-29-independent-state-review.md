# Independent Watch delivery review, 2026-09-29

Scope: read-only review delegated by codex-root. Product baseline `19843d3b750ee5d47b9ff4afb795e420fbe1118c`, main. No production mutations or email sends. Only this receipt was written. Root owns any implementation and shared coordination updates.

## Production and coordination evidence

- Initial `git status --short`: clean. `npm run agent`: main, 15 active ownership entries, no warnings.
- `npm run agent:heartbeat -- --json` at `2026-09-29T07:38:36.927Z`: 11 in-progress, 4 review, no blocked/queued tasks; GOAL.md missing. Scope owners include signup/readiness, UI, Shopify and Outcome launch. This review does not supersede their scopes or claim launch completion.
- Read-only `GET https://fixflags.com/api/health`: HTTP 200, `commit=19843d3b750ee5d47b9ff4afb795e420fbe1118c`, migrations ok, productWatch available, email/worker configured.
- Read-only `GET https://fixflags.com/api/health/ready`: HTTP 200, free-launch profile, no missing requirements, all subsystems ok. Endpoint `checkedAt=2026-09-29T08:39:55.052Z`.
- This confirms the deployed commit and reported readiness. It does not prove inbox delivery, scheduler restart recovery, exact web/worker image equivalence, customer value, or the complete release journey matrix. ROADMAP Gate 5 explicitly still requires scheduler restart and email sink proof.

## Reproduced findings

All line numbers below refer to baseline `19843d3b`. The actual TypeScript module was read from disk, transpiled in memory with the installed TypeScript compiler to CommonJS, and executed through `node:vm`. Database, email, diff and telemetry imports were replaced with deterministic in-memory fakes. No test/product files, external services, or databases were changed.

### P1: rejected notification becomes SENT

`lib/audit/project-watch.ts:389` awaits `resend.emails.send` but does not inspect its result. Lines 395-401 then persist SENT. The installed Resend SDK at `node_modules/resend/dist/index.js:561` returns `{data:null,error:...}` for API errors instead of necessarily throwing. Existing `lib/email/send.ts:56` correctly checks this error contract.

Reproduction: a pending Watch notification with one regression; provider resolves `{data:null,error:{message:'provider rejected delivery'}}`.

Observed persisted status sequence: `SENDING -> SENT`. The retry query excludes SENT, so a rejected alert is permanently suppressed while telemetry claims it was sent.

Expected: reject an error response or missing success receipt, record FAILED with useful error, keep it eligible for bounded retry. Preserve a stable provider idempotency key.

### P1: interrupted SENDING is never recovered

`lib/audit/project-watch.ts:355-365` claims SENDING without a notification lease. `retryPendingWatchNotifications` at lines 419-435 queries only PENDING/FAILED. Repository search found no alternate SENDING recovery.

Reproduction: invoke the retry function and inspect its actual query. Observed eligibility is `{in:['PENDING','FAILED']}`. A worker death after claim and before terminal persistence leaves SENDING forever, whether the provider accepted the message or not.

Expected: bounded stale-claim reclamation with concurrency protection and the same provider idempotency key. Account for interruption of the fifth claim: it has attempts=5 but no confirmed terminal result. Validate separately from normal exhausted FAILED retries. Provider acceptance must not be confused with inbox delivery.

### P2: telemetry failure rewrites delivered notification to FAILED

`lib/audit/project-watch.ts:403-415` places `recordSiteLifecycleEvent` inside the delivery try/catch. The telemetry implementation in `lib/analytics/site-events.ts` performs a database upsert and can reject.

Reproduction: provider resolves `{data:{id:'email-1'},error:null}`; SENT update succeeds; lifecycle event throws `telemetry unavailable`.

Observed status sequence: `SENDING -> SENT -> FAILED`. The next sweep retries already accepted mail. Provider idempotency may limit duplicate delivery, but durable state and attempt accounting are still false.

Expected: persist delivery truth independently, and log/recover telemetry separately without converting SENT to FAILED.

### P2: one poison item stops the retry batch

`lib/audit/project-watch.ts:432-434` awaits each notification without per-item error isolation. Reads, diff calculation, completion update, and failure persistence may reject outside the delivery catch. `projectWatchTick` catches only the entire sweep.

Reproduction: retry query returns `[broken, healthy]`; first audit read rejects `first row read failed`. Observed reads: `[broken]`; function throws; healthy is not processed. A persistent oldest failure can repeatedly block the rest of a batch.

Expected: isolate per-notification failures and continue remaining eligible rows, while retaining a visible diagnostic.

## Verification and next action

- Baseline reproduction output:
  - provider-error: status writes `[SENDING,SENT]`.
  - telemetry-error: status writes `[SENDING,SENT,FAILED]`.
  - stranded: retry statuses `[PENDING,FAILED]`.
  - retry-isolation: reads `[broken]`, thrown `first row read failed`.
- `npm run agent -- verify --dry-run`: no checks selected for the current documentation-only state. This receipt makes no full-suite pass claim.
- Findings and reproduction outputs sent to codex-root, who is claiming the notification delivery/retry implementation only. Success should include provider rejection then acceptance, telemetry outage after accepted send, stale SENDING after restart, fresh-claim exclusion, and one failing row followed by a healthy row.
- After deterministic regression coverage, run a controlled real-path email sink / restart probe before claiming production delivery recovery. No production email probe was performed by this reviewer.

## Implementation review follow-up

Root implemented the delivery-truth repair and requested independent read-only review. Reviewed the working-tree diff for `lib/audit/project-watch.ts` and its focused test file:

- Provider rejection is now checked explicitly; absence of `data.id` also fails closed instead of recording SENT.
- Delivery state persistence completes before the separate telemetry try/catch. Analytics failure now logs a diagnostic without rewriting SENT.
- Regression test exercises the installed Resend SDK against mocked HTTP 429 then 200 responses, enters the actual retry function, and inspects the stable `Idempotency-Key` header. This is stronger evidence than a direct send mock returning an assumed shape.
- Root reports all 15 focused tests pass after first observing the new regression tests fail on baseline. This reviewer inspected the code/test diff but did not independently rerun the same passing suite.
- No blocking defect found in the reviewed repair. Retry batch isolation is additionally being implemented by root. The crash-left SENDING gap remains explicitly open and requires a bounded lease/provider idempotency-window design; this repair does not claim restart recovery.

State: implementation reviewed locally, focused pass reported by implementer, not yet production-verified by this reviewer. Health observations above describe the baseline deployment, not the new working-tree repair.
