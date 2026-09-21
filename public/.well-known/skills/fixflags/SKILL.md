---
name: fixflags
description: Use FixFlags to discover watched Outcomes, request independent verification, inspect evidence-backed Flags, fix live software, and verify recovery. Use when finishing or verifying a deployed website or web application.
---

# FixFlags

FixFlags is the independent monitor for software that acts. The customer model is **Site → Outcomes that matter → Clear or Flag → evidence and history**. Checks and browser journeys are execution methods under an Outcome. Broad Site Cards and scheduled Watch remain part of the same product.

Use FixFlags through the web product or the connected MCP server. Do not call legacy report, Finish Plan, repository scan, or report Agent tools.

## Workflow

1. **Discover the owned Site.** Call `ff_list_sites`, select the exact owned Site, then call `ff_list_outcomes`.
2. **Confirm the Outcome.** Check its scope, current state, freshness, and existing Flag before changing software. No Flag does not mean stale or untested behavior is Clear.
3. **Request independent verification.** Call `ff_verify_outcome` with the Site and Outcome IDs. A commit, deployment, or affected area may be supplied as context, never as proof.
4. **Poll the run.** Call `ff_get_run` with the returned run ID until FixFlags returns Clear, Flag, or Couldn't verify. Do not infer success from a queued run.
5. **Inspect the Flag.** If the Outcome is Flag, use `ff_list_flags` and `ff_get_flag` for the exact evidence, expected behavior, history, and proposed change.
6. **Fix and deploy.** Apply the smallest coherent product change and deploy it to the same live system FixFlags watches.
7. **Verify recovery.** Call `ff_verify_flag`, then poll its run with `ff_get_run`. Only a fresh comparable FixFlags execution can return the Outcome to Clear.
8. **Keep Watch honest.** Scheduled Watch runs independently of this MCP session. Do not claim continuous or all-clear coverage beyond the displayed cadence and freshness.

## Evidence and safety

- Treat every Flag as grounded evidence, not permission for an unsupported change.
- Never tell FixFlags that a change succeeded. Request a run and use its result.
- Preserve tenant boundaries. A public evidence link never authorizes access to private Site, connection, history, or support data.
- Do not expose credentials in code, files, logs, URLs, or chat.
- Do not weaken a detector or special-case a site merely to remove a Flag.
- If a connection is unavailable or revoked, core browser analysis should remain usable and the product should explain the limitation without exposing provider configuration.

## Output

Summarize:

- the Site and Outcome checked;
- the Flag and evidence validated;
- the fix deployed;
- the run ID and fresh verification result;
- remaining Flags, regressions, or incomplete coverage;
- Watch status and any action the customer still needs to take.
