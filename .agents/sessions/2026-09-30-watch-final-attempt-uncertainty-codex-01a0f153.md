# Watch final-attempt uncertainty

**Owner:** `codex-01a0f153`

**Status:** locally implemented and verified; not deployed or customer-validated

**Scope:** close the inherited P1 in `watch-notification-lease-recovery-2026-09-29`

## Customer outcome

FixFlags no longer shows an abandoned final Watch alert as “sending” forever. When the fifth delivery claim expires without a recorded provider result, FixFlags stops retrying, marks the attempt terminal, and tells the customer it could not confirm delivery while making clear that Watch is still checking the Site.

## Decision

The final provider result is unknowable after a worker dies. Sending a sixth email can duplicate an alert the provider already accepted. Saying the alert definitely missed the inbox can also be false. The bounded and honest outcome is to terminalize the claim without another send and use confirmation-safe customer language.

## Implementation

- The retry sweep caps `PENDING` and `FAILED` retries but always includes expired `SENDING` leases, including the exhausted final claim.
- `notifyWatchRegression` atomically changes an expired fifth `SENDING` claim to `FAILED`, clears its lease, records a diagnostic, and returns before any provider call.
- The customer delivery projection receives the lease expiry. An exhausted expired `SENDING` claim renders terminal immediately, even before the sweep persists the transition; an unexpired claim still renders as delivering.
- Customer copy now says FixFlags could not confirm delivery, not that the alert certainly failed to arrive.
- The audit-pipeline skill and durable lease learning now encode the final-attempt rule.

## Evidence

- Focused Watch sender, customer notice, and Site board suite: 3 files, 58 tests passed.
- Non-incremental TypeScript and scoped ESLint passed.
- Copy drift, UI drift, product contract, completeness, skill validation, and diff checks passed.
- Optimized Next production build passed, including Site home and settings surfaces.
- The earlier full verifier in this environment stops at `db:check` because PostgreSQL is unavailable at `localhost:5432`; Redis and the configured OrbStack Docker socket are also unavailable. No fresh database-backed or container receipt is claimed.

## Limits and next action

No real provider call was made, production was not changed, and recovery remains unobserved in production. When release infrastructure is available, rerun `npm run doctor` and the full verifier, then deploy under existing release authority. A deliberate production failure drill still requires separate approval because it sends and interrupts a real customer alert path.
