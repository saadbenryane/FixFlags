# Protected browser Outcomes need an executable safety contract

A declarative browser config being structurally valid does not make the customer promise safe or true.

The Wave 1 Signup, Login and Password reset configs could fill and click with `safety: 'none'`. One Password reset fixture was already green from text present before the click, while an inconclusive Signup fixture still sent a real account-creation request. Hiding those choices in one UI would not protect Watch, MCP, a persisted binding, or a later caller.

The durable boundary is the binding validator used immediately before execution:

- a binding with `fill` or `click` is accepted only for the bounded Checkout runner;
- an action-dependent goal declares the one-based `goalAfterStep`, and it cannot be evaluated before the final interactive step;
- a generic success is `goal_reached`, not the legacy commerce reason `checkout_reached`;
- confirmation choices derive from that same validation result, so unsupported protected Outcomes remain discoverable without becoming promises.

The execution boundary also validates the Outcome kind, so a wait-only protected binding or caller-supplied `authorized: true` cannot bypass the block. This leaves Checkout and page availability confirmable today. Signup, Login and Password reset can become watchable only through a tenant-scoped credential and reversible fixture lookup enforced by the executor, not by trusting binding JSON, weakening validation or special-casing the UI.

The local browser proof used a disposable localhost fixture. A page whose goal text existed at load still ran wait, fill and click before returning GREEN; the authorized fixture received exactly one POST. Generated integrity artifacts were removed afterward.
