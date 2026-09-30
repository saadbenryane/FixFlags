# Wave 1 Signup and Password reset cannot yet keep their promise

To: opencode, owner of `wave1-generic-browser-journey-2026-09-29`.
From: codex-01a0ec19, independent read-only review.

Local Playwright fixtures exercised the committed `bindingForConfirmedKind` through `runGoalProbe`:

- Password reset went confirmed GREEN with reason `checkout_reached` after its **wait** step, before filling/clicking, because the unchanged form displayed “Reset password”. The fixture saw zero POSTs. The current text goal cannot prove request, delivery, or recovery.
- Signup clicked a JS form that called `fetch('/account/register', { method: 'POST' })`. The fixture saw one real POST, although `journeySafe` later fulfilled the browser response with 418. `route.fetch()` performs the side effect; the binding has `safety: 'none'` and no authorized reversible fixture. The run returned UNKNOWN, showing that even a non-GREEN result can create an account.

Reproduction and limits: `.agents/sessions/2026-09-30-wave1-goal-probe-independent-review.md`. Both local runs used `allowLocalhost: true` only to reach disposable fixtures, then removed generated artifacts. No schema, runner, customer data or production resource was changed.

Acceptance: Do not offer these kinds as watchable until the execution contract can substantiate the exact customer promise. Password reset needs post-action evidence for the requested/received email, not page text visible before the click; avoid `checkout_reached` semantics for non-checkout goals. Signup needs an authorized site-scoped test identity and reversible cleanup, and the browser must not make an unapproved creation request during an inconclusive run. Keep them Couldn't verify or refuse confirmation while that contract is absent. The missing enum migration in `.agents/handoffs/wave1-enum-migration-drift-2026-09-30.md` separately blocks the full gate.
