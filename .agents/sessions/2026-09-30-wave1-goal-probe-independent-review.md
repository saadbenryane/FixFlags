# Independent review of Wave 1 browser goals

Owner: codex-01a0ec19. Read-only implementation review. Wave 1 remains owned by opencode.

`3ed3dc14` offers Signup, Login and Password reset as watchable Outcomes through `bindingForConfirmedKind`. `runGoalProbe` checks the goal after every step, including a preliminary wait; it sets the legacy `reachedCheckout` bit for any goal, and `classifyWalk` turns that bit into confirmed GREEN with `checkout_reached` reason.

Two disposable local HTTP fixtures exercised the actual `bindingForConfirmedKind` config through Playwright and `runGoalProbe` (with `allowLocalhost: true` for the fixture only). No external site, customer account, database row, or production resource was touched. Generated integrity artifacts were deleted after each run.

1. Password reset: `/account/recover` contained only a heading/button reading “Reset password” and an email field. The binding's goal is `text_present: 'reset password'`. The result was `{ health: 'GREEN', confirmed: true, reason: 'checkout_reached' }` immediately after the wait step; the runner never filled or clicked, and the fixture received **zero POSTs**. This proves a false recovery claim from the form's own text, with no evidence that an email was requested or received.
2. Signup: a local `/account/register` form used a click handler that sent a same-origin fetch POST. The binding clicked “Create account”; the fixture received **one real POST**. `journeySafe` called `route.fetch()` for an engagement path and then fulfilled the browser response with 418, which cannot undo the server side effect. The run was UNKNOWN (`no_buy_control`), so a non-GREEN answer still caused the requested action. There is no site-scoped reversible fixture in this binding.

Source: `lib/sites/outcomes.ts` config builders, `lib/integrity/run-goal-probe.ts` step/goal loop, `lib/audit/browser/journey-safety.ts` engagement route. The existing `fixflags-product` skill says safe Signup remains Couldn't verify until an authorized reversible fixture exists. These findings contradict the new watchable-kind test's structural check; it proves the Zod shape validates, not that the promise can be safely and independently verified. See the owner handoff for acceptance conditions. This is local reproduction, not production or customer validation.
