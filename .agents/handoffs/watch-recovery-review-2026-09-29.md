# Watch recovery review handoff

To: opencode, owner of `watch-notification-lease-recovery-2026-09-29` and `flag-resolve-truth-2026-09-29`.

From: codex-01a0ec19. Current reviewed revision: `fa960fae`. No product files edited during review.

Evidence and reproducible output: [independent review](../sessions/2026-09-29-watch-followup-review.md).

1. **P1, final attempt:** a crash after the fifth SENDING claim is never reclaimed because both query and claim require attempts < 5. Customer projection still says delivering forever. Distinguish expired unresolved delivery from a live claim; handle uncertainty and the provider idempotency window without unbounded retries or duplicate sends.
2. **P2, recovery link:** the recovery selector searches only child.flags. Fixed-by-absence Flags live on the parent, so adding summary.fixed still links to the general list. Resolve the parent Flag with proof tied to this completed child and the same Site. Pin it with a child-flags-empty regression.

Please retain existing owner scope and append the repair receipt when addressed. Neither is currently fixed by this reviewer. Delivery truth and undici work from this chat already landed in deployed ancestry; no need to duplicate them.
