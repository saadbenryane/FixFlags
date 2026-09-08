/**
 * Executable contracts for the customer loop. These entries are intentionally
 * explicit: route discovery may inventory a handler, but it cannot invent a
 * success fixture or count an invalid request as success evidence.
 */
export const CUSTOMER_ROUTE_CONTRACTS = [
  {
    file: 'app/api/checks/route.ts',
    method: 'POST',
    auth: 'anonymous-or-session',
    input: 'body.url is a valid public http(s) URL',
    success: '201 with a persisted queued Review id',
    failures: ['invalid-input', 'conflict', 'dependency-failure'],
    idempotency: 'server deduplicates an active Review for the same owner and URL',
    fixture: 'reachable public URL with PostgreSQL, Redis, and worker ready',
  },
  {
    file: 'app/api/reports/[id]/route.ts',
    method: 'GET',
    auth: 'review-visibility',
    input: 'params.id names an existing visible Review',
    success: '200 with public-safe Review serialization',
    failures: ['unauthenticated', 'forbidden', 'not-found', 'dependency-failure'],
    idempotency: 'read-only',
    fixture: 'completed owner and public-viewer Reviews',
  },
  {
    file: 'app/api/reports/[id]/status/route.ts',
    method: 'GET',
    auth: 'review-visibility',
    input: 'params.id names a running or completed visible Review',
    success: '200 with lifecycle state, deterministic Agent updates, and redacted fields',
    failures: ['forbidden', 'not-found', 'dependency-failure'],
    idempotency: 'read-only',
    fixture: 'running, completed, partial, and failed Reviews',
  },
  {
    file: 'app/api/reports/[id]/re-check/route.ts',
    method: 'POST',
    auth: 'owner',
    input: 'params.id names a completed owned Review',
    success: '201 with a fresh parented update Review',
    failures: ['invalid-input', 'unauthenticated', 'forbidden', 'not-found', 'conflict', 'dependency-failure'],
    idempotency: 'active child Review is reused instead of duplicated',
    fixture: 'owned completed Review with available monthly Review capacity',
  },
  {
    file: 'app/api/reports/[id]/retry/route.ts',
    method: 'POST',
    auth: 'owner-or-anonymous-creator',
    input: 'params.id names a retryable failed Review',
    success: '200 with the same Review requeued as a new execution attempt',
    failures: ['unauthenticated', 'forbidden', 'not-found', 'conflict', 'dependency-failure'],
    idempotency: 'non-failed and already-active Reviews reject duplicate retry',
    fixture: 'failed retryable owner and anonymous Reviews',
  },
  {
    file: 'app/api/reports/[id]/chat/route.ts',
    method: 'POST',
    auth: 'owner',
    input: 'body.message is non-empty and params.id is an owned Review',
    success: '200 with a persisted evidence-grounded Agent response',
    failures: ['invalid-input', 'unauthenticated', 'forbidden', 'not-found', 'dependency-failure'],
    idempotency: 'client message identity prevents duplicate turns',
    fixture: 'owned completed Review with Agent provider ready',
  },
  {
    file: 'app/api/projects/[id]/watch/route.ts',
    method: 'PUT',
    auth: 'owner-with-watch-capability',
    input: 'body.interval is weekly, daily, or null',
    success: '200 with a durably scheduled or disabled Watch',
    failures: ['invalid-input', 'unauthenticated', 'forbidden', 'not-found', 'dependency-failure'],
    idempotency: 'setting the same interval converges on one schedule',
    fixture: 'owned Product with Watch-ready worker and queue',
  },
  {
    file: 'app/api/products/[id]/signals/route.ts',
    method: 'POST',
    auth: 'product-signal-key',
    input: 'origin, key, release, and event batch satisfy the Product Signals schema',
    success: '202 with deduplicated durable Product Signals',
    failures: ['invalid-input', 'forbidden', 'not-found', 'conflict', 'dependency-failure'],
    idempotency: 'event ids are unique per Product',
    fixture: 'owned Product with an active origin-bound signal key',
  },
  {
    file: 'app/api/flags/[id]/attempts/route.ts',
    method: 'POST',
    auth: 'owner',
    input: 'action-specific attempt body and an owned Flag',
    success: '201 with a durable handoff, decision, or Improvement attempt receipt',
    failures: ['invalid-input', 'unauthenticated', 'not-found', 'conflict', 'dependency-failure'],
    idempotency: 'one open attempt per Improvement and source Review',
    fixture: 'owned Review Flag materialized into Product attention',
  },
]

export function customerContractFor(file, method) {
  return CUSTOMER_ROUTE_CONTRACTS.find(
    (contract) => contract.file === file && contract.method === method,
  ) ?? null
}
