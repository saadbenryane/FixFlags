# Watch delivery requires provider acceptance

- Date: 2026-09-29
- Scope: scheduled Watch regression notifications
- Confidence: high for local provider-boundary behavior; production delivery unverified
- Evidence: `.agents/sessions/2026-09-29-watch-delivery-truth.md` and independent state review; regression tests in `lib/audit/__tests__/project-watch.test.ts`

The installed Resend SDK resolves HTTP rejection as `{ data: null, error }`; awaiting the promise is insufficient proof of acceptance. Ignoring this shape marked rejected alerts SENT and removed them from retry eligibility. Analytics shared the delivery catch and could also change accepted SENT to FAILED.

Only a successful provider response with an ID may persist SENT. Keep analytics failure separate from delivery state. Isolate retries per record so a broken audit cannot starve other Sites. Preserve stable provider idempotency keys. SENT establishes provider acceptance, not arrival in an inbox.

Prevention: SDK-backed HTTP 429-to-200 retry regression, malformed receipt test, telemetry-failure test, per-record retry-isolation test, and the audit-pipeline skill. Crash-left SENDING requires separate bounded recovery and is still open.
