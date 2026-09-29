# Watch notification delivery truth

Owner: codex-01a0ec19. Baseline: `19843d3b750ee5d47b9ff4afb795e420fbe1118c`. Scope: notification delivery and batch retries only; Watch cadence, entitlements, signup and Shopify ownership preserved.

## Customer outcome

Provider-rejected Watch alerts stay failed and eligible for the existing bounded retry. An accepted email remains sent if analytics fails. A broken notification no longer stops the remaining Sites in the batch. SENT means provider acceptance, not inbox delivery.

## Evidence

- Initial production health returned healthy, migrations ok, Watch available, and exact baseline SHA. This supersedes the board's old production-lag observation, but does not establish end-to-end delivery.
- Independent baseline reproductions and review: `2026-09-29-independent-state-review.md`.
- Added regression tests first: provider HTTP 429 falsely became SENT; telemetry failure reverted SENT to FAILED; missing provider receipt falsely became SENT. All three failed before the fix and passed after it. A fourth batch-isolation regression also failed before its fix.
- The rejection/retry test uses the installed Resend SDK, stubbed HTTP 429 then 200, the real `notifyWatchRegression` and scheduler retry function, and asserts the same idempotency header. Database persistence is simulated; no real email was sent.
- `npm run agent -- verify --dry-run` selected 11 commands. `npm run agent -- verify` passed all 11, including typecheck, full lint, audit tests (137 files passed, 2 skipped; 1,615 tests passed, 9 skipped), brand/UI/image/SEO/metadata/copy/help guards. Logs: `.agent-runs/2026-09-29T07-41-*`.
- `npm run doctor` passed environment, local PostgreSQL, Redis, Chromium, migrations, and worker prerequisites.
- `npm run verify` reached security audit and stopped on pre-existing pinned `undici@7.29.0`, GHSA-3wwx-pv8p-q78v. No full-pass claim. Separate dependency repair follows.
- Release preflight foundation failed: missing `RELEASE_FRESH_DATABASE_URL`, `RELEASE_CONTAINER_ENV_FILE`, and explicit `RELEASE_ALLOW_DATABASE_RESET=true`. External stage failed: missing release origin/API key/fixture manifest and E2E Watch account, Site and mailbox assertion URL. No credentials printed or production data changed.
- Heartbeat source: `npm run agent:heartbeat -- --json`, 2026-09-29. Initial packet had 11 in-progress and 4 review entries; current task was added with distinct scope.

## Decision and next action

Adopt the bounded repair; locally verified, independently reviewed, not deployed or customer-validated. Full release evidence remains open. Do not push main until release requirements are satisfied or release authority explicitly authorizes a scoped alternative.

Remaining reliability work: crash-left SENDING has no recovery lease. Do not simply retry every old SENDING row: design an immutable payload/claim receipt and bounded provider idempotency window, including an interrupted fifth attempt and concurrent workers. This issue is not fixed by delivery-error handling.

Hourly continuation is configured in this chat (`build-fixflags-continuously`), quiet on unchanged/non-actionable state. Next independent action: fix the audit-blocking dependency patch, validate, then resume the notification crash-recovery design with the above safety constraints.
