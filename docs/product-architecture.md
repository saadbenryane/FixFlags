# FixFlags product architecture

**Status: TARGET. Reconciled 2026-09-21.** Public claims still follow [PRODUCT.md](../PRODUCT.md). Sequence and launch scope live in [product-masterplan.md](product-masterplan.md).

FixFlags is the independent monitor for software that acts. **Your software runs. FixFlags watches.**

## Authority and boundaries

| Question                               | Owner                                                           |
| -------------------------------------- | --------------------------------------------------------------- |
| Why and for whom                       | [knowledge/vision.md](../knowledge/vision.md)                   |
| Customer objects and system shape      | **This file**                                                   |
| Evidence, coverage, and recovery truth | [knowledge/evidence-rules.md](../knowledge/evidence-rules.md)   |
| Delivery order and launch gate         | [product-masterplan.md](product-masterplan.md)                  |
| Current code                           | [PRODUCT.md](../PRODUCT.md)                                     |
| Legacy report behavior                 | [knowledge/report-contract.md](../knowledge/report-contract.md) |

This is an evolutionary architecture. It preserves the Site product, Audit pipeline, browser/check engine, Flags, Watch, integrations, auth, billing, and MCP infrastructure. Internal storage names do not dictate customer language.

## Product hierarchy

```text
Account
  └── Product / Site
        ├── Outcomes that matter
        │     ├── execution methods
        │     ├── Clear / Flag / Couldn’t verify / Stale
        │     └── evidence, history and diagnostics
        ├── broader Product health
        ├── Flags needing attention
        ├── Watch policy and triggers
        └── Connections
```

At launch, **Site** is the customer name and existing `Project` is its physical tenant-owned backing. It is broad enough for a web product with pages, browser journeys, APIs, commerce, and connections. Do not add a new root System/Product/Monitor model until a real non-web target cannot be represented safely.

## Canonical objects

| Object            | Customer job                                                                   | Physical/reused implementation                                | Not                                   |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------- |
| Site              | The live product FixFlags watches                                              | `Project`, `ProvisionalSite`                                  | A report or one-time scan             |
| Outcome           | An important result that should work, such as Checkout, Signup, Login, Publish | Adapted `SiteOutcome`                                         | A technical assertion or generic task |
| Execution binding | How FixFlags can independently assess an Outcome                               | check, browser Journey, HTTP/API probe, integration evaluator | A top-level customer product          |
| Assessment        | Current evidence-backed Outcome state                                          | new projection over Audit/binding results                     | A cached optimistic status            |
| Flag              | A meaningful failure needing action                                            | stable `Improvement` plus Flag occurrence/evidence            | Every failed assertion                |
| Recommendation    | Useful non-urgent improvement or diagnostic                                    | non-customer-Flag findings                                    | Another inbox                         |
| Run request       | Why, what, and for whom FixFlags should execute                                | additive tenant-scoped request                                | A separate engine per trigger         |
| Run               | Physical execution and evidence ledger                                         | existing `Audit` pipeline                                     | Customer-facing “Audit” product       |
| Watch             | Policy that creates scheduled Run Requests                                     | Project Watch/scheduler                                       | Dependent on MCP presence             |
| Connection        | Authorized context or specialized execution source                             | Shopify now; later adapters                                   | A mini-product or logo marketplace    |
| FixFlags Agent    | In-product explanation/navigation/support                                      | Site Agent threads/messages                                   | The coding agent or verifier          |
| Coding agent      | External actor that changes software and requests verification                 | MCP client / copied handoff                                   | A trusted source of truth             |

## Outcome semantics

The current `SiteOutcome` is a useful seed, not a complete health model. Today it provides a stable Site-scoped ID, name, slug, description, inference/confirmation provenance, and related pages. It does **not** yet provide an expectation, execution binding, environment, criticality, state, freshness, history, or Flag link. It must be adapted before Outcome becomes the primary UI unit.

An Outcome contains:

- a human name and expected result;
- Site, environment, criticality, enabled state, origin, and confidence;
- relevant surfaces/dependencies;
- one or more versioned execution bindings;
- required versus supporting evidence policy;
- latest assessment and freshness;
- related Flags and history.

Examples:

| Outcome       | Possible execution bindings                      | Supporting diagnostics                                       |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| Checkout      | browser Journey; Shopify purchase-path probe     | console/network errors, mobile layout, performance, tracking |
| Signup        | safe browser Journey; form network probe         | accessibility, auth configuration, page availability         |
| Publish       | HTTP/API check; later authenticated browser flow | deployment event, response schema, page reachability         |
| API operation | HTTP request/response plus final-state read      | latency, error telemetry, deployment context                 |
| MCP tool task | later tool discovery/call/final-state evaluator  | permission and protocol diagnostics                          |

A Journey is therefore a human-facing execution method, not a synonym for every Outcome. Keep “Journey” for paths a person takes through a browser. Do not call an API or MCP tool flow a Journey merely to reuse a label.

## Outcome health versus signal health

Outcome and signal state are deliberately separate.

- **Outcome failure:** FixFlags reproduced that the expected important result did not occur. It may create or update a Flag.
- **Diagnostic failure:** a check, device run, header, performance metric, script, or integration signal is unhealthy. It contributes evidence and may create a Recommendation or broader health Flag, but does not automatically prove an Outcome failed.
- **Coverage gap:** required execution was blocked, skipped, unsupported, stale, or incomplete. State is Couldn’t verify/Unknown, never Clear.

Broad product health remains useful. Pages, Security, Search, Performance, Tracking, Uptime, Accessibility, commerce, mobile, and Recommendations stay under the Site as category cards and diagnostics. They may support several Outcomes, stand alone as important Product health, or remain non-urgent depth. The new hierarchy does not reduce FixFlags to journeys.

## Assessment states

| State           | Meaning                                                    | Requirements                                                         |
| --------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Clear           | The expected Outcome worked in the required scope recently | comparable required bindings completed; coverage and freshness shown |
| Flag            | Something important did not behave as expected             | reproduced/qualified evidence and customer-importance projection     |
| Couldn’t verify | FixFlags could not produce comparable required evidence    | reason, attempted scope, recovery action                             |
| Stale           | Last useful evidence is older than policy                  | last known result remains historical, not current truth              |

Cards may still use category-specific attention/unknown states, but customer Outcome state resolves to this vocabulary. “No Flags” is not Clear without required evidence.

## Execution architecture

### One application command

Every initiator submits the same tenant-scoped request:

```text
requestRun({
  owner,
  siteId,
  trigger,
  outcomeIds | allImportant,
  environment,
  idempotencyKey,
  changeContext?
})
```

`lib/sites/application` owns authorization, Site resolution, policy, Outcome selection, idempotency, planning, enqueue, and customer projections. Manual UI, Watch, MCP, deployment webhooks, API, Shopify, and internal recovery are adapters to this command. None owns another monitoring engine.

### Run lifecycle

```text
RunRequest
  → authorize Site and target
  → resolve Outcomes and enabled bindings
  → plan existing Audit work
  → execute the canonical lifecycle in [audit-pipeline.md](audit-pipeline.md)
  → reconcile binding evidence
  → write OutcomeAssessment
  → project Flag occurrences/recovery
  → apply notification policy
```

The existing Audit remains the physical run/evidence ledger. Customer language says “FixFlags checked Checkout,” “Checking,” or “Last verified,” not “an Audit was created.” Audit IDs may appear in deep diagnostics/support, not primary navigation.

### Independence

The requester may provide commit, deployment, changed areas, environment, and a requested Outcome. These inputs are provenance and selection hints. They cannot supply the result. FixFlags independently executes owned bindings and evaluates evidence. Recording a fix never resolves a Flag.

## Flags and verification

A durable Flag answers: an important Outcome or Product responsibility is not behaving as expected.

```text
Working/Clear
  → failure observed
  → Flag occurrence opened
  → fix context recorded
  → targeted verification requested
  → Verified Clear | Still open | Regressed | Couldn’t verify
  → recurrence reopens same stable Flag
```

Keep `Improvement` as the stable internal fingerprinted identity and occurrences/attempts/verifier executions as history. Add optional Outcome attribution rather than replacing these models. A Site-wide security or performance Flag may be legitimate without one Outcome.

Verification must select the same Outcome, environment, success condition, and comparable binding scope. Missing, blocked, skipped, removed, or incomparable evidence cannot resolve a Flag.

## Human information architecture

### Account

```text
Sites
Billing
Account settings
Help/support
```

No Reports, raw Runs, Tests, MCP analytics, or Agent workspace in primary navigation.

### Site

```text
Home
  What FixFlags is watching (Outcomes)
  Needs attention (Flags)
  Broader Product health (category cards)
Flags
  inbox → detail → Fix → Verify → history
Settings
  Outcomes · Watch · notifications · connections · developer access · danger zone
```

Pages and category cards remain inspectable depth. Outcome detail shows expected behavior, state/freshness, related surfaces, evidence, recent runs, Flags, and diagnostics. Raw checks and steps are disclosed progressively.

Desktop and mobile share the same objects. Mobile uses Home · Flags · More; Outcome and Flag detail become full-screen. The FixFlags Agent remains a context-aware control, not a tab.

## Trigger model

| Trigger     | Purpose                                     | Authority                                |
| ----------- | ------------------------------------------- | ---------------------------------------- |
| Schedule    | keep selected important Outcomes current    | Watch policy                             |
| Human UI    | analyze, run or verify intentionally        | authenticated owner/session              |
| MCP         | coding agent requests independent evidence  | scoped token/key acting for owner        |
| Deployment  | focus monitoring after a successful release | verified provider adapter + Site mapping |
| API         | external automation requests a run          | scoped credential                        |
| Integration | connection detects a relevant change        | authorized connection principal          |
| Internal    | recovery, stale evidence or product policy  | FixFlags service principal               |

All produce the same RunRequest and assessment semantics. Scheduled monitoring remains independent of MCP.

## MCP architecture

MCP is launch scope and a first-class interaction channel, not the product hierarchy.

- Reuse the official SDK, Streamable HTTP transport, stdio bridge, device auth, API-key storage, interaction ledger, editor catalog, and installer.
- Replace the report/Fix-List public tool contract with Site/Outcome/Run/Flag tools defined in the masterplan.
- Remote interactive access uses OAuth 2.1 discovery, scoped and audience-bound tokens. API keys remain for CI/local bridge.
- Long work returns a durable FixFlags run handle immediately. Polling is the compatibility baseline; MCP Tasks is optional when negotiated.
- Tools call only `lib/sites/application`; they do not read report projections or authorize by hostname/report publicity.
- The coding agent can learn what is watched, request execution, inspect evidence, record fix context, and request verification. It cannot report success on FixFlags’ behalf.

## Connections and machine-facing expansion

Shopify is the launch connection and commerce binding. Deployment context is a trigger. Existing public tracking and other deterministic signals remain diagnostics. Search Console, analytics, Meta, GitHub, and other providers stay parked until each improves a named Outcome or Product-health decision.

The first post-launch machine-facing binding should be deterministic HTTP/API verification. It exercises the same Outcome/Run/Flag/Verify contract without requiring generalized autonomous-agent evaluation. Later MCP/agent evaluators may check tool discovery, permissions, intended action, affected object, and final state, but they are not a launch prerequisite.

## Access and privacy

- Tenant identity is explicit through Site, RunRequest, Outcome, Flag, connection, queue payload, storage key, rate limit, support packet, and MCP token.
- Hostnames, URLs, public report IDs, and opaque object IDs are never authorization.
- Public URL execution remains behind SSRF-safe target validation and per-redirect/DNS checks.
- Credentials and connection secrets remain encrypted and referenced, not copied into Outcome binding JSON, evidence, or MCP output.
- Evidence outputs are minimized and access-checked. Public compatibility does not grant Site access.
- Tool/request telemetry stores internal IDs and coarse metadata, not prompts, raw page bodies, cookies, headers, input values, or secrets.

## Compatibility and retirement

| Legacy capability   | New home                                        | Retirement rule                                   |
| ------------------- | ----------------------------------------------- | ------------------------------------------------- |
| Ranked report Flags | Site Flags / Outcome detail                     | owner redirects and parity proven                 |
| Report evidence     | Flag/Outcome evidence; sanitized public adapter | public access policy and telemetry proven         |
| Update review       | RunRequest / Verify                             | all callers migrated                              |
| Score/rubrics       | internal diagnostics/compatibility              | no primary consumers                              |
| Finish Plan         | prioritized Flags / agent query                 | no new UI/MCP use                                 |
| Report Agent        | Site Agent/support                              | Site grounding and escalation proven              |
| Old `ff_*` tools    | Site/Outcome MCP contract                       | compatibility window and usage telemetry complete |
| Repo scan tools     | parked separate capability                      | not part of this launch                           |

Do not mass-rename storage. Do not keep two customer products. Compatibility adapters flow one way toward the new Site application boundary and never become dependencies of it.
