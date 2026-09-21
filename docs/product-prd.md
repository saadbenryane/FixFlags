# FixFlags independent-monitor requirements

**Status: TARGET, accepted 2026-09-21.** Purpose: [vision](../knowledge/vision.md). Architecture: [product-architecture](product-architecture.md). Delivery: [masterplan](product-masterplan.md) and [roadmap](../ROADMAP.md). Current behavior: [PRODUCT.md](../PRODUCT.md).

## Product outcome

A customer connects a live product, understands the Outcomes FixFlags watches, sees whether each is Clear or needs a Flag, fixes a real failure, and receives independent proof of recovery. Watch continues without a human or coding agent present. The same monitoring engine serves UI, MCP, deployment, API, integration, and scheduled requests.

## Domain requirements

| Object                 | Requirement                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site/Product           | Stable private tenant-owned container. Existing `Project` remains the physical backing at launch.                                                                                                                                           |
| Outcome                | Important expected result with stable identity, expectation, criticality, environment, enabled state, provenance, bindings, assessment, freshness, and history. Adapt existing `SiteOutcome`; do not create a parallel objective hierarchy. |
| Execution binding      | Versioned independent method that can assess an Outcome: deterministic check, browser Journey, HTTP/API check, or integration/agent evaluator.                                                                                              |
| RunRequest             | Tenant-scoped, idempotent request recording trigger, selected Outcomes, environment, actor/client, bounded change context, state, and resulting execution.                                                                                  |
| Run                    | Existing Audit/worker execution ledger. Internal machinery, not customer product language.                                                                                                                                                  |
| Assessment             | `Clear`, `Flag`, `Couldn’t verify`, or `Stale`, with scope, time, coverage, evidence, and binding provenance.                                                                                                                               |
| Flag                   | Stable meaningful attention item with Outcome/Product scope, occurrences, evidence, fix attempts, verification, recovery, and recurrence.                                                                                                   |
| Signal/category health | Supporting evidence and broader health such as security, performance, search, tracking, uptime, accessibility, pages, mobile, and commerce. It does not automatically equal Outcome health.                                                 |
| Watch                  | Durable schedule that creates the same RunRequest without MCP or a user session.                                                                                                                                                            |
| Connection             | Tenant-authorized context or specialized execution source with purpose, health, permissions, provenance, and revocation.                                                                                                                    |

## Primary human journey

1. **Analyze.** Enter a safe public URL and create/resume one provisional Site.
2. **Learn visibly.** Persist real pages, evidence, and candidate Outcomes. Show partial/failed work honestly.
3. **Confirm responsibility.** Let the customer confirm/edit an important Outcome without configuring a testing framework.
4. **See the product.** Home shows watched Outcomes, Needs attention, then broader Product health. No report detour.
5. **Open a Flag.** Show expected versus observed behavior, evidence, scope, certainty, limitation, impact, and next step.
6. **Fix.** Copy/send evidence to a coding tool or use MCP. A handoff/commit/deployment records context only.
7. **Verify.** Run the same relevant Outcome scope independently and preserve pass/open/regressed/inconclusive history.
8. **Keep watching.** Claim the same Site and activate a durable schedule before claiming coverage.
9. **Return.** A meaningful notification opens the exact Outcome/Flag. Clear runs stay quiet.

## Primary MCP journey

1. Connect through `npx fixflags init` or remote OAuth and bind to an owned Site.
2. List watched Outcomes and current state.
3. Request a run for one Outcome or all important Outcomes.
4. Receive a durable run ID immediately; poll after disconnect/restart.
5. Receive Clear or a Flag with evidence and limitation.
6. Record the change/deployment without changing the verdict.
7. Request targeted independent verification.
8. Retrieve Clear, Still open, Regressed, or Couldn’t verify from FixFlags-owned evidence.

## Execution and truth requirements

- UI, MCP, Watch, deployment, API, Shopify/integration, and internal triggers call one Site application command.
- The caller supplies selection/provenance, never assessment truth.
- Required binding failure/blocked state is explicit. Missing or incomparable evidence never yields Clear or Verified.
- Raw signal failure becomes diagnostic evidence unless Outcome expectation/importance rules justify a Flag.
- Broad category health remains available even when it is not attached to one Outcome.
- Stable Flag identity conservatively matches recurrence and retains all occurrences.
- Verification is idempotent; one pending attempt/run survives retries and worker restarts.
- Every queue/storage/read path carries verified tenant context.

## Launch Outcome patterns

| Pattern      | Existing foundation                                          | Launch boundary                                                                                             |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Checkout     | Journey runner, flow/network evidence, Shopify purchase path | Reach cart/checkout safely; do not place a real order by default.                                           |
| Signup/form  | Journey/form probe, network engagement, auth/checkout checks | Prove safe completion/feedback where no irreversible account action is required; otherwise Couldn’t verify. |
| Availability | page capture, response/network/console evidence              | Prove reachable/rendered expected surface, not business completion.                                         |

Protected Login/Password reset/Publish may be discovered and shown as unsupported or unconfigured until explicit safe credentials and reset contracts exist. Public examples must match the implemented boundary.

## MCP requirements

- New discovery exposes only the small Site/Outcome/Run/Flag contract in the masterplan.
- Remote auth uses OAuth 2.1 discovery/scopes/audience binding; scoped keys/device auth remain for CI/stdio.
- All state-changing tools require explicit Site and idempotency key and are accurately annotated.
- Long runs return a handle in under five seconds; polling is mandatory compatibility, Tasks optional.
- Errors are typed and recoverable where possible; no stack/provider/env details.
- Interaction logs exclude prompts, raw page content, secrets, headers, bodies, and input values.
- Cross-tenant, arbitrary-host, revoked/insufficient credential, and rate-limit cases fail closed.

## Acceptance scenarios

| Scenario                                          | Required outcome                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| Required Outcome bindings pass                    | Clear with current scope/freshness and evidence references                  |
| No required behavior can run                      | Couldn’t verify with reason/recovery; never Clear                           |
| Diagnostic HTTP/security/performance signal fails | Supporting diagnostic or broader health Flag; not automatic Outcome failure |
| Checkout fails on mobile only                     | Checkout Flag scoped to mobile; desktop pass does not erase it              |
| Coding agent says fixed                           | Attempt context recorded; state unchanged until FixFlags execution          |
| Targeted Verify still fails                       | Same Flag remains open with a new attempt/result                            |
| Evidence disappears or is blocked                 | Couldn’t verify; no recovery from absence                                   |
| Comparable scope passes after fix                 | Verified recovery and Outcome Clear with provenance                         |
| Failure returns                                   | Same stable Flag reopens with a new occurrence                              |
| Duplicate trigger or reconnect                    | One RunRequest/result; durable handle remains readable                      |
| Watch runs with MCP disconnected                  | Schedule continues and reconciles normally                                  |
| Worker/queue/email unavailable                    | Visible retry/delay/failure state; no false coverage or lost result         |
| Two users use the same hostname                   | Strict tenant isolation across Site, Outcome, runs, Flags, evidence and MCP |
| Connection revoked                                | Core monitoring stays usable; dependent coverage becomes unavailable        |
| Existing customer migrates                        | Site, history, subscription, Watch and Shopify identity remain intact       |

## Scope limits

Launch does not require generalized autonomous-agent evaluation, arbitrary Outcome builders, a new System root, raw test/run dashboards, session replay, autonomous code changes, irreversible purchases/refunds, or every integration. The architecture must permit deterministic HTTP/API and later MCP/agent evaluators without changing the customer hierarchy.
