# FixFlags independent-monitor masterplan

**Status: ACTIVE TARGET AND SOLE IMPLEMENTATION PLAN. Reconciled 2026-09-21 against the Checkout implementation on `main`; exact-SHA production proof remains open.**

FixFlags is the independent monitor for software that acts.

**Your software runs. FixFlags watches.**

This file owns what to build, in what order, and what may be called launch-ready. It replaces the former website-care wave plan. The working Site product is the migration base, not discarded work. Public claims remain limited to [PRODUCT.md](../PRODUCT.md) until a capability passes the acceptance evidence in this plan.

### First vertical slice: Checkout

| Slice element | Local implementation | Remaining proof |
| --- | --- | --- |
| Outcome/binding/assessment | Additive `SiteOutcome` semantics, `OutcomeExecutionBinding`, `OutcomeAssessment` and non-destructive migrations | Fresh production migration and exact-revision canary |
| Shared execution | One tenant-scoped `RunRequest` from web, Watch and MCP into the existing Audit worker; database-enforced one active run | Credentialed schedule/restart and competing-trigger exercise |
| Truth | Confirmed Checkout success is Clear; confirmed reproducible failure is Flag; blocked/unknown is Couldn't verify; expired evidence is Stale | Real owned-Site broken → fixed → recovery sequence |
| Incident | Checkout occurrence reuses a stable Site Flag identity; targeted Verify keeps attempt history | Recurrence and notification return on a canary Site |
| Developer access | Site/Outcome/Run/Flag MCP tools, hashed account keys, device flow, CLI bridge, setup and docs | Codex/Claude/Cursor client matrix and remote OAuth/scopes |
| Public hierarchy | Checkout Outcome leads the Site board and homepage example; broad cards remain | Complete mobile/public route pass and exact deployed sample |

This checkpoint is **not** the public launch. No acceptance checkbox below is closed merely by a migration or unit test. The next highest-leverage work is an end-to-end credentialed Checkout canary followed by remote MCP authorization and deployment/integration trigger alignment.

| Authority                                  | Source                                                          |
| ------------------------------------------ | --------------------------------------------------------------- |
| Purpose and product principles             | [knowledge/vision.md](../knowledge/vision.md)                   |
| Customer objects and technical shape       | [product-architecture.md](product-architecture.md)              |
| Evidence, certainty, and recovery          | [knowledge/evidence-rules.md](../knowledge/evidence-rules.md)   |
| **Sequence, launch scope, and acceptance** | **This file**                                                   |
| Milestones and dependency order            | [ROADMAP.md](../ROADMAP.md)                                     |
| Current workspace truth                    | [PRODUCT.md](../PRODUCT.md)                                     |
| Existing persistence reuse                 | [site-v2-migration.md](site-v2-migration.md)                    |
| Current execution mechanics                | [audit-pipeline.md](audit-pipeline.md)                          |
| Legacy report compatibility                | [knowledge/report-contract.md](../knowledge/report-contract.md) |

## Product decision

The launch product watches important outcomes in live software and expresses each as **Clear**, **Flag**, **Couldn’t verify**, or **Stale**, always with scope and freshness. Examples are Signup, Login, Checkout, Publish, and Password reset. A customer sees the outcome first; checks, browser steps, HTTP requests, integration observations, and AI-assisted execution stay underneath as evidence.

The core loop remains **Flag → Fix → Verify**. Scheduled monitoring and agent-requested verification are triggers into the same independent execution system. MCP ships at launch, but FixFlags remains useful and keeps watching when no coding agent is connected.

The launch container remains the existing customer **Site** because the current product, tenancy, browser engine, Watch scheduler, pricing, and first-value flow are URL-first. “Software” broadens what a Site can watch; it does not justify a new root table before a non-web target requires one. The first-class health unit becomes the existing **Outcome**. A browser Journey is one way to exercise an Outcome, not the universal abstraction.

## 1. Current-state assessment

### Directly reusable foundation

| Capability               | Repository reality                                                                                                                                   | Decision                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Owned monitor            | Prisma `Project`, customer Site projection, provisional Site and idempotent claim                                                                    | Keep as the launch tenant boundary.                          |
| Important intent         | `SiteOutcome`, `SiteOutcomePage`, inferred/confirmable outcomes                                                                                      | Adapt with expectation, state, bindings, and history.        |
| Browser execution        | Playwright capture, deterministic checks, safe Journey runner, screenshots, network and accessibility evidence                                       | Keep as the independent human-facing executor.               |
| Run ledger               | `Audit`, pages, pipeline events, costs, stages, worker queue and recovery                                                                            | Keep; change customer projections, not storage names.        |
| Checks                   | Registered checks with stable IDs and verifier provenance                                                                                            | Keep as evidence producers beneath Outcomes.                 |
| Journeys                 | `JourneyReview`, steps, findings, templates, planner/evaluator and safety constraints                                                                | Adapt into one Outcome execution-binding type.               |
| Flags                    | `Flag`, importance projector, stable `Improvement` fingerprint, occurrences and cycles                                                               | Keep; attach to an Outcome when evidence supports it.        |
| Verification             | `ImprovementAttempt`, verifier executions, comparability and targeted Site Verify                                                                    | Keep and make Outcome-scoped.                                |
| Always-on care           | weekly/daily Watch, leases, restart recovery, retries, notification preferences and email                                                            | Keep; use the common run-request boundary.                   |
| Event triggers           | manual/API/MCP sources, Railway deployment webhook, ProductSignal and Shopify events                                                                 | Merge as triggers into one command.                          |
| Shopify                  | embedded auth, explicit shop-to-Project link, purchase-path execution and Site Flag projection                                                       | Keep as a connection and specialized Outcome binding.        |
| Human product            | Sites list, Home, Flags, Flag detail, Settings, Agent/support foundation                                                                             | Adapt hierarchy toward watched Outcomes and attention.       |
| Auth/security            | better-auth, passkeys, API keys, owner-scoped routes, SSRF-safe fetch, encrypted scan access                                                         | Keep; add MCP scopes and target resolution.                  |
| MCP delivery             | Streamable HTTP, structured results, tool registry, interaction ledger, API keys, device flow, stdio CLI bridge, `npx fixflags init`, editor catalog | Adapt, unpark, and replace the report-shaped contract.       |
| Billing                  | Free/Pro/Studio, one free Site, Watch policy, Stripe quantity/lifecycle foundation                                                                   | Keep; MCP follows Site responsibility, not review credits.   |
| Operations               | readiness, heartbeat, pipeline ledger, lifecycle analytics, admin/support views                                                                      | Keep; add Outcome/run/MCP reliability views.                 |
| Report/Product workspace | sanitized evidence compatibility and old projections                                                                                                 | Deprecate as customer models; retain adapters temporarily.   |
| Repo scan/fix PR         | separate GitHub code-scanning queue                                                                                                                  | Keep parked; not required for independent live verification. |

### What already expresses the vision well

- The live homepage explains Flag. Fix. Verify., browser journeys, live verification, evidence, Watch, and Shopify as context.
- The Site board hides most check mechanics and separates meaningful Flags from Recommendations.
- Verify records a fix attempt separately from the fresh FixFlags run. A builder declaration does not certify success.
- Watch is durable and quiet on healthy runs, with explicit failure state and notification controls.
- MCP already uses the official SDK, Streamable HTTP, structured outputs, annotations, API-key ownership, and an interaction ledger.

### Debt that blocks launch

1. Only Checkout currently has complete Outcome semantics. Other inferred Outcomes remain descriptive; a second binding must prove the model beyond commerce.
2. Web, Watch, and MCP now enter through one RunRequest, but deployment, integration, and legacy API triggers still enter report-shaped services.
3. The registered MCP surface is Outcome-first; old report tools remain source compatibility and hidden CLI handlers. Exact-client/prod proof and remote OAuth are open.
4. Remote MCP auth is long-lived API-key only. Interactive launch clients need OAuth discovery and scoped, audience-bound tokens; API keys remain appropriate for CI and the stdio bridge.
5. Deployment verification is Railway-specific and generic rather than Site/Outcome-scoped.
6. `/samples` is a Site board with one retained evidence-backed non-Checkout Flag, while the homepage now illustrates Checkout. Neither should be mistaken for credentialed Checkout production proof. MCP docs and setup are reachable locally.
7. Machine-facing Outcome execution has no launch adapter. The architecture can support it, but claiming it now would be false.
8. Legacy Product/report/credit vocabulary still crosses application seams even where storage names may safely remain.

## 2. Existing-capability mapping

This inventory is the rewrite guardrail. “Adapt” means extend the current implementation; it does not authorize a parallel replacement.

| Existing capability                 | Current implementation                                                                                                                                     | Future role                                                    | Decision                 | Required work                                                                                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned product                       | Prisma `Project`, customer Site projection, owner ID and canonical host                                                                                    | Project/Product container that FixFlags watches                | Keep                     | Keep `Project` physical and Site customer-facing for the URL-first launch; add no second root model.                                                                                                          |
| Anonymous first value               | `ProvisionalSite` plus post-login claim                                                                                                                    | Same Product identity before and after signup                  | Keep                     | Preserve idempotent claim when Outcome records/bindings are added.                                                                                                                                            |
| Public graph                        | global graph `Site`/`Page`                                                                                                                                 | Public discovery/SEO knowledge only                            | Keep separate            | Add guards so no Outcome/MCP authorization uses it.                                                                                                                                                           |
| Product surfaces                    | `SitePage` related to Project or provisional Site                                                                                                          | Known surfaces/dependencies for Outcomes                       | Keep                     | Retain many-to-many Outcome relationship and evidence provenance.                                                                                                                                             |
| Outcome intent                      | `SiteOutcome`: name, slug, description, inference source, confirmation, related pages                                                                      | First-class important result such as Checkout or Signup        | Adapt                    | Current semantics are insufficient: add expectation, criticality, environment, enabled state, bindings, assessment/freshness, and Flag attribution; prove one vertical slice before switching the primary UI. |
| Browser journeys                    | `JourneyReview`, steps/findings, safe templates, AI planner/evaluator                                                                                      | One human-facing execution method beneath an Outcome           | Adapt                    | Link versioned Journey binding to Outcome; preserve every historical review and safety rule.                                                                                                                  |
| Deterministic checks                | 20+ check modules for availability-adjacent errors, security, search, performance, mobile, accessibility, interaction, forms, tracking, content and layout | Evidence producers for Outcome or broader Product health       | Keep                     | Register binding/diagnostic applicability; do not force every check into an Outcome or delete broad health signals.                                                                                           |
| Page/category health                | coverage projector and cards for Pages, Security, Search, Performance, Conversion, Tracking, Uptime and Accessibility                                      | Broader Product health and diagnostics below Outcome/attention | Adapt                    | Separate raw signal health from Outcome health; retain category coverage and Recommendations as secondary depth.                                                                                              |
| Flow scan/network evidence          | CTA flow, post-click, slow replay, network engagement, form probe                                                                                          | Low-cost behavioral evidence and selected Outcome bindings     | Merge                    | Attach exact source/scope to assessments; do not equate one broken signal with Outcome failure automatically.                                                                                                 |
| Audit pipeline                      | `Audit`, `AuditPage`, six stages, pipeline events, storage, cost and recovery                                                                              | Physical execution/run ledger                                  | Keep internal            | Continue using it as the engine; project “FixFlags checked Checkout” to customers, never make Audit the product noun.                                                                                         |
| Trigger metadata                    | `AuditSource`, `RecheckTrigger` (`MANUAL/WATCH`), attribution                                                                                              | Compatibility fields on a richer run request                   | Adapt                    | Add RunRequest and trigger vocabulary, then map/dual-write old fields.                                                                                                                                        |
| Per-run finding                     | `Flag` tied to Audit/page/check with evidence and fingerprint                                                                                              | Observation feeding a durable Flag                             | Keep                     | Add Outcome attribution when justified; retain unattributed Site-wide findings.                                                                                                                               |
| Durable Flag                        | `Improvement` keyed by Project/fingerprint                                                                                                                 | Customer Flag identity across runs                             | Adapt                    | Keep customer projection named Flag; add optional Outcome scope and no mass rename.                                                                                                                           |
| Incident history                    | occurrences, cycles and cycle events                                                                                                                       | Detected, cleared, regressed, acted-on history                 | Keep                     | Use as the canonical Flag lifecycle underneath Outcome detail.                                                                                                                                                |
| Fix/verify                          | `ImprovementAttempt`, targeted Site command, verification Audit and verifier executions                                                                    | First-class independent recovery proof                         | Keep/adapt               | Record source Outcome/binding/success condition; reconcile only comparable fresh evidence.                                                                                                                    |
| Scheduled monitoring                | Project Watch policy, leases, worker scheduler, retries and email                                                                                          | Independent always-on trigger                                  | Keep                     | Submit the same tenant-scoped RunRequest used by UI/MCP; preserve cadence and quiet healthy behavior.                                                                                                         |
| Manual/UI verification              | Site Verify command and generic monitoring services                                                                                                        | Human trigger into the same engine                             | Merge                    | Route through the common run command without changing the browser/queue engine.                                                                                                                               |
| Deployment trigger                  | Railway signed webhook, release record and generic `checkAndPlan`                                                                                          | Deployment-context trigger                                     | Adapt                    | Resolve an owned Site, select Outcomes, enqueue RunRequest; keep commit/deployment context non-authoritative.                                                                                                 |
| API trigger                         | `/api/checks`, Site routes and report APIs                                                                                                                 | Programmatic trigger/read model                                | Adapt                    | Add Site/Outcome run API; retain report endpoints only for compatibility.                                                                                                                                     |
| Product signals                     | bounded ProductSignal events including deployment/outcome/error                                                                                            | Supporting context or trigger                                  | Merge                    | Treat as provenance/diagnostic input, never independent proof of Clear.                                                                                                                                       |
| Shopify                             | shop-to-Project link, RevenuePath probes, VerificationRun, purchase Flags                                                                                  | Commerce Outcome binding and context connection                | Merge                    | Feed the common Run/Assessment/Flag lifecycle while specialized storage remains useful.                                                                                                                       |
| Other integrations                  | GSC and GitHub OAuth/code, editor catalog; Meta/analytics concepts                                                                                         | Future context or execution adapters                           | Keep parked              | Expose only after tenant/privacy review and a named Outcome/health answer improves.                                                                                                                           |
| Site UI                             | Sites list, Home cards, Flags, detail, Settings                                                                                                            | Human view of Outcomes, attention, diagnostics, Watch          | Adapt                    | Put Outcomes and Needs attention first; keep category breadth underneath.                                                                                                                                     |
| Site Agent/support                  | persisted Site Agent threads/messages and support escalation                                                                                               | Explain/navigation/human help                                  | Keep                     | Ground on Outcome assessments and Flags; never act as verifier.                                                                                                                                               |
| MCP transport                       | official SDK Streamable HTTP endpoint and stdio bridge                                                                                                     | Coding-agent interface to the same Product/Outcome engine      | Keep                     | Replace discovered report tools with Site/Outcome contract and unpark after end-to-end proof.                                                                                                                 |
| MCP authentication                  | hashed API keys, device authorization and client identity                                                                                                  | Interactive OAuth plus CI/local credentials                    | Adapt                    | Add OAuth discovery/scopes/audience binding; retain scoped keys/device flow.                                                                                                                                  |
| MCP interaction ledger              | `McpInteraction` with tool, client, latency, success and Audit ID                                                                                          | Protocol reliability/security telemetry                        | Adapt                    | Add Site/Outcome/Run/Flag identity and privacy-safe error taxonomy.                                                                                                                                           |
| Editor installation                 | `fixflags-cli`, `npx fixflags init`, Codex/Claude/Cursor/Windsurf config and published skill                                                               | One-command launch connection                                  | Keep/adapt               | Bind to owned Site, update instructions/tools, verify real clients and avoid repo-stored secrets.                                                                                                             |
| Report                              | public-safe `/report` compatibility and report projections                                                                                                 | Temporary sanitized evidence adapter                           | Deprecate                | Redirect owners; stop new dependencies; retire after telemetry/support proof.                                                                                                                                 |
| Scores/rubrics/Fix List/Finish Plan | report and old MCP ranking contract                                                                                                                        | Internal evaluation/compatibility only                         | Deprecate in new product | Remove from new UI/tool discovery; retain stored history as needed.                                                                                                                                           |
| Repo scan/fix PR                    | GitHub scan queue and MCP tools                                                                                                                            | Separate code-analysis capability                              | Keep parked              | Exclude from launch MCP because it blurs acting versus independently watching.                                                                                                                                |
| Billing                             | Free/Pro/Studio, Site policy, Stripe quantity/lifecycle and legacy review limits                                                                           | Pays for monitored responsibility/cadence                      | Keep/adapt               | MCP uses Site policy and bounded manual runs, never resurrects review-credit packaging.                                                                                                                       |
| Operations                          | readiness endpoints, heartbeat, admin audits/support/analytics and lifecycle events                                                                        | Run/Outcome/MCP reliability operations                         | Keep/adapt               | Add assessment, comparability, queue, client, notification and per-run cost views.                                                                                                                            |

## 3. Target product model

```text
Account
  └── Site (physical Project)
        ├── Outcome: "Checkout"
        │     ├── expectation + criticality + environment
        │     ├── ExecutionBinding[]
        │     │     ├── deterministic check
        │     │     ├── browser Journey
        │     │     ├── HTTP/API check
        │     │     └── integration/MCP evaluator (later)
        │     ├── latest OutcomeAssessment (Clear / Flag / Unknown / Stale)
        │     └── Flags[] → occurrences → fix attempts → verification
        ├── RunRequest[] (schedule, deploy, human, MCP, API, integration, internal)
        │     └── Run (physical Audit) → executions → evidence → assessments
        ├── Connections[]
        └── WatchPolicy
```

### Rules

- Extend `SiteOutcome`; do not add a competing Monitor, Test, or Goal root for launch.
- Separate Outcome from ExecutionBinding so the same Outcome can evolve from browser to API evidence without splitting customer identity.
- A run is selected by Site, Outcome set, trigger, environment, and optional requested revision.
- Trigger context such as commit, deployment URL, or changed areas affects selection and history, never the verdict.
- Only FixFlags-owned execution and comparable evidence can assess an Outcome or verify a Flag.
- A failed assertion becomes a Flag only through the importance projector and Outcome criticality.
- Outcome state is `CLEAR`, `FLAG`, `UNKNOWN` (including couldn’t verify), or `STALE`. Clear requires current required coverage.
- `Audit` stages, queue, worker, browser, evidence, cost, and recovery remain the engine.
- `lib/sites/application` is the application boundary for UI, MCP, Watch, Shopify, webhooks, and API. New code cannot import report projections.

### Additive data changes

1. Extend `SiteOutcome` with kind/category, expectation, criticality, environment, enabled state, source/confidence, and last assessment pointers.
2. Add `OutcomeBinding` with type, versioned configuration, scope, enabled state, and provenance. Secrets reference encrypted connection storage.
3. Add `RunRequest` with owner/Site, trigger, requested Outcomes, idempotency key, actor/client, bounded change context, status, resulting Audit, and timestamps.
4. Add `OutcomeAssessment` linking Outcome, Audit, binding executions, state, reason, coverage, and evidence references.
5. Add nullable Outcome attribution to stable Improvement/occurrence/attempt projections where known. Preserve unattributed history.
6. Add trigger values `SCHEDULE`, `MANUAL`, `MCP`, `DEPLOYMENT`, `INTEGRATION`, `API`, and `INTERNAL`; map old `MANUAL/WATCH` fields during transition.

Do not rename `Project`, `Audit`, or `Improvement` in the first migration. Do not create a generic knowledge graph.

## 4. Launch product

### Launch-critical

- Analyze a live URL, claim the same Site, confirm or edit an important Outcome, and enable weekly Watch.
- Site Home leads with watched Outcomes and current attention: `Checkout — Flag`, `Signup — Clear`, `Password reset — Couldn’t verify`. Category cards remain grouped depth.
- Three patterns work end to end: page availability, safe form/signup-like completion, and purchase/cart-to-checkout reachability. Protected or irreversible flows are honestly unsupported until safe credentials/fixtures exist.
- Outcome detail shows expectation, assessment, freshness, evidence, history, related Flags, and coverage limitation.
- A failure creates or updates one durable Flag. A coding agent can inspect it, record what changed, request verification, and retrieve the independent result.
- Watch, manual UI, deployment webhook, API, and MCP use the same RunRequest and planner/executor/reconciler.
- MCP works from Codex, Claude Code, and Cursor through remote HTTP or the local stdio bridge, with a small Outcome-shaped tool set and durable async results.
- Watch continues without an agent. Healthy runs are quiet. Regression/recovery notifications link to the exact Outcome/Flag.
- OAuth 2.1 discovery and scoped authorization protect remote MCP; API keys remain for CI/stdio and are scoped/revocable.
- Public website, docs, sample, Help, pricing, onboarding, notifications, and metadata tell the same story without overstating machine-facing execution.
- Existing Shopify monitoring, billing identity, Site history, and useful report links survive.

### Post-launch enhancement

- Additional deployment providers and repository-aware change selection.
- Authenticated browser Outcomes with encrypted test credentials and safe reset contracts.
- Deterministic HTTP/API contract Outcome, the smallest useful machine-facing expansion.
- MCP Tasks extension/push after client support is proven. Launch uses durable FixFlags run IDs and polling.
- MCP-server tool discovery, permission, side-effect, and final-state evaluators.
- Analytics, Search Console, Meta, broader Slack, more commerce platforms, cross-environment comparison, collaboration, public grants, and custom Outcome builders.

## 5. MCP v1 specification

MCP is a remote interface to the Site application boundary, not a report API or second test runner.

### Tools

| Tool                     | Purpose                                               | Mutation           | Scope                    |
| ------------------------ | ----------------------------------------------------- | ------------------ | ------------------------ |
| `fixflags.list_sites`    | Accessible Sites and attention summary                | No                 | `sites:read`             |
| `fixflags.list_outcomes` | Outcomes, state, freshness, aliases                   | No                 | `sites:read`             |
| `fixflags.run`           | Independently run selected/all important Outcomes     | Creates RunRequest | `runs:write`             |
| `fixflags.get_run`       | Poll progress and retrieve assessments                | No                 | `runs:read`              |
| `fixflags.list_flags`    | Current Flags, optionally by Outcome                  | No                 | `flags:read`             |
| `fixflags.get_flag`      | Evidence, expectation, limitation, fix/verify history | No                 | `flags:read`             |
| `fixflags.record_fix`    | Record commit/deployment/change context; never verify | Yes                | `flags:write`            |
| `fixflags.verify_flag`   | Create/reuse targeted independent verification        | Yes                | `runs:write flags:write` |

Keep old `ff_*` tools for one compatibility window behind adapters, hidden from new docs, with deprecation metadata. Remove rubric, score, Finish Plan, repo-scan, and prompt-generation tools from the launch list.

### Resources

- `fixflags://sites/{siteId}`: Site summary and coverage.
- `fixflags://sites/{siteId}/outcomes/{outcomeId}`: expectation, state, bindings, freshness, history links.
- `fixflags://sites/{siteId}/flags/{flagId}`: sanitized owned Flag evidence and attempts.
- `fixflags://runs/{runId}`: progress and final assessments.

Resources contain references and minimized summaries, never raw cookies, bodies, private headers, or unrestricted screenshots. Tools return strict structured content plus text for older clients.

### Resolution, context, and async behavior

- Every mutating tool requires `siteId`; aliases resolve only when exactly one owned match exists. Hostnames and opaque IDs are never authorization.
- Outcome names resolve through exact aliases; ambiguity returns candidates.
- `fixflags.run` may accept deployment URL, commit, branch, changed areas, and a bounded change summary as provenance/selection hints only.
- Requested URLs must belong to the Site or an authorized preview origin. SSRF and scan-access rules apply.
- Idempotency keys return the existing RunRequest on retry.
- Run/verify tools return in under five seconds with `runId`, selected Outcomes, queue estimate, and `pollAfterMs`. They do not hold a browser run open.
- `get_run` survives disconnect/restart. Adopt MCP Tasks only additively for clients advertising support; client support still varies.
- Results distinguish `CLEAR`, `FLAG`, `COULD_NOT_VERIFY`, `FAILED`, and `CANCELLED`.

### Authentication and security

- Remote HTTP implements OAuth 2.1 authorization code + PKCE, Protected Resource Metadata, authorization-server discovery, resource/audience binding, scopes, and correct 401/403 challenges per the current [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
- Keep hashed API keys for CI/stdio. Require client, scopes, expiry/revoke, and never accept keys in query strings.
- `npx fixflags init <site-url>` uses device authorization and writes only managed config; no repo credential.
- Authorize again in each tool. Rate-limit by account, Site, host, tool class, and pending run; cost-bearing calls fail closed if rate limiting is unavailable.
- A coding agent cannot submit a verdict, resolve a Flag, bypass browser safety, select another tenant, or request irreversible transactions.
- Log tool, client, Site/run/Flag IDs, latency, and outcome code, not prompts, page text, credentials, headers, or evidence bodies.
- Use accurate read-only/idempotent/open-world annotations and human confirmation for mutations, following [MCP tool guidance](https://modelcontextprotocol.io/specification/2026-07-28/server/tools).

### Developer experience and errors

One command configures Codex, Claude Code, Cursor, or a generic client: `npx fixflags init https://app.example.com`. Browser approval binds it to an owned Site. Test actual clients, not just SDK units.

Typed errors: `AUTH_REQUIRED`, `INSUFFICIENT_SCOPE`, `SITE_NOT_FOUND`, `AMBIGUOUS_SITE`, `OUTCOME_NOT_FOUND`, `UNSUPPORTED_OUTCOME`, `RUN_ALREADY_PENDING`, `RATE_LIMITED`, `TARGET_BLOCKED`, `COVERAGE_UNAVAILABLE`, `WORKER_UNAVAILABLE`.

## 6. UX alignment

### Keep

Brand, Site shell, Home/Flags/Settings routes, card system, evidence views, Flag detail, Fix handoff, Verify progress/history, support, auth, billing, responsive patterns, and URL-first Analyze.

### Change

- Home first shows **What FixFlags is watching**, then **Needs attention** when Flags exist; technical categories move below.
- **Outcome** is the umbrella (“Checkout”); **Journey** is a human browser path (“Product to checkout”). API/MCP behavior is not called a Journey.
- `Clear` is scoped/current; `Flag` is actionable; `Couldn’t verify` explains a gap; `Stale` asks for a run.
- Outcome detail, not raw run detail, becomes the depth surface. Runs live in history.
- “Send to your AI” gains “Connect through MCP” after setup, while copy remains available.
- Site Settings gains Outcomes, Watch, notifications, connections, and developer access. API keys/MCP setup move from parked account routes.
- Replace the public legacy report sample with one real Site, five Outcomes, and one Checkout Flag.
- Public message evolves to “Your software runs. FixFlags watches.” while launch examples state the current web scope honestly.

### Do not add

A Tests tab, Runs tab, MCP dashboard, integration marketplace, agent-monitoring mini-product, deployment-verification mini-product, generic Outcome builder, or green state based only on zero Flags.

## 7. Technical workstreams

| Workstream             | Concrete work                                                             | Depends on       | Exit evidence                           |
| ---------------------- | ------------------------------------------------------------------------- | ---------------- | --------------------------------------- |
| A. Outcome projection  | schema, projector, IDs/aliases, Flag attribution, backfill                | Current tenancy  | projection tests + migration rehearsal  |
| B. Unified run command | RunRequest, trigger adapters, idempotency, planner, enqueue/reconcile     | A                | equivalent owned runs from each trigger |
| C. Execution bindings  | wrap checks/Journeys; Outcome selection; blocked truth                    | A, B             | three real worker/browser fixtures      |
| D. Flag lifecycle      | Outcome occurrence, record-fix, Verify, recurrence, comparability         | A–C              | broken → open → verified → recurred     |
| E. Watch/events        | scheduled selection, deploy/Shopify adapters, notification dedupe         | B–D              | restart/retry + quiet healthy proof     |
| F. MCP launch          | tools/resources, OAuth/scopes, keys, polling, CLI/editor setup, telemetry | A–D              | Codex/Claude/Cursor matrix              |
| G. Human UX            | Outcome-first Home/detail/settings and accessibility                      | A–F projections  | responsive/keyboard/zoom matrix         |
| H. Public/docs         | positioning, sample, onboarding, reference, metadata, route contract      | E–G              | live public crawl                       |
| I. Operations/security | OAuth threat model, tenancy, cost/readiness/admin metrics                 | B/F              | security/cost/canary evidence           |
| J. Cleanup             | old MCP/report/Product consumers and routes                               | H + measured use | redirects/410s, no new consumers        |

Billing: Free stays one Site with weekly Watch and bounded manual/MCP verification. Pro stays `$49/site/month`, daily, and waitlisted until cost proof. MCP is an interface to Site responsibility, not unlimited reviews.

## 8. Migration strategy

1. Add nullable tables/columns; preserve Sites, Audits, Flags, subscriptions, Shopify shops, and Watch schedules.
2. Backfill Outcomes from existing `SiteOutcome`; derive bindings only from explicit Journey/check provenance. Never infer a pass from missing evidence.
3. Dual-write RunRequest/OutcomeAssessment while Audit remains authoritative; shadow-compare projections before switching reads.
4. Move Site UI and new MCP to Outcome projections. Old report APIs/MCP tools read through one-way adapters and cannot become new-domain dependencies.
5. Convert Watch, Railway, and Shopify triggers one at a time with idempotency and adapter rollback.
6. Preserve unattributed historical Flags/attempts as Site-wide rather than fabricating Outcome links.
7. Existing API keys continue until expiry/revocation; offer scoped replacement without silently broadening access.
8. Redirect signed-in report owners to Site/Outcome/Flag. Keep sanitized public evidence until telemetry and support prove retirement safe.

Rollback is projection-level, not destructive schema reversal. Keep migrations additive until the launch has operated through a full weekly Watch cycle.

## 9. Documentation alignment

Canonical order: vision → architecture → evidence rules → this plan → roadmap/PRD → current implementation. During the first workstream reconcile `AGENTS.md`, `knowledge/README.md`, `CANONICAL-SOURCES.md`, `docs/voice-and-copy.md`, `docs/workspace-interface.md`, `docs/card-board-experience.md`, `docs/site-v2-migration.md`, `CODEMAP.md`, `ARCHITECTURE.md`, `docs/audit-pipeline.md`, and `SECURITY.md`. Update public Docs/Help only with working behavior.

Mark `docs/journey-review-architecture.md`, `docs/unified-audit-tool-architecture.md`, and old report/Fix List/MCP plans historical after their useful constraints are absorbed. Do not silently delete institutional knowledge.

## 10. Prioritized implementation sequence

### Immediate

1. Lock additive Outcome/Binding/RunRequest/Assessment contracts and tenant tests.
2. Prove one Checkout vertical slice: existing Journey → Outcome state → Flag → MCP read → record fix → independent Verify → history → Watch.
3. Move manual Verify, Watch, Railway, Shopify, API, and MCP behind one Site command.
4. Ship the small MCP contract, OAuth/scopes, durable polling, CLI/editor setup, and compatibility adapters.
5. Reorganize Site UI around concrete Outcomes and attention without replacing the shell.
6. Add safe Signup/form and availability patterns; prove Clear, Flag, Couldn’t verify, Stale, partial, and recurrence.
7. Align public lifecycle surfaces and replace the sample after the real paths work.
8. Run exact-SHA production canary plus MCP client and accelerated weekly-cycle matrices.

Steps 2–6 depend on the shared contract in step 1. After it lands, MCP auth/protocol, UI, trigger adapters, and public documentation can proceed in parallel but converge on the same Checkout fixture.

### Next

HTTP/API Outcome binding, more deployment adapters, authenticated safe browser Outcomes, optional MCP Tasks, environment comparison, dependency/context learning, and paid opening only after cost/reliability proof.

### Later

MCP-server and agent-tool correctness, permission/side-effect evaluators, sandboxed irreversible-action testing, more connections, custom Outcomes, teams/public grants, and proprietary execution infrastructure only when measured need justifies it.

## 11. Launch acceptance criteria

- [ ] Analyze → signup → exact Site claim → return works without duplicate identity or lost evidence.
- [ ] Important Outcomes are inferred/confirmed and shown in plain language.
- [ ] Checkout, safe Signup/form, and availability patterns run through the existing worker/browser/check engine.
- [ ] Outcome state is scoped/current; untested behavior never appears Clear.
- [ ] Important failure creates/reopens one durable Outcome-linked Flag with evidence and limitation.
- [ ] Fix handoff/`record_fix` stores change context but never changes the verdict.
- [ ] Verify independently reruns matching scope; pass, open, regression, blocked, missing, and incomparable cases reconcile correctly.
- [ ] Watch continues without an agent, recovers after restart, stays quiet when Clear, and deduplicates meaningful notifications.
- [ ] UI, Watch, deployment, API, Shopify, and MCP all enter the same tenant-scoped RunRequest path.
- [ ] Codex, Claude Code, and Cursor authenticate, resolve Site/Outcome, run, reconnect/poll, inspect a Flag, record a fix, and verify.
- [ ] MCP cannot cross tenants/hosts, expose credentials/private evidence, or accept caller-certified success; OAuth and key revocation are proven.
- [ ] Shopify, Site history, subscriptions, anonymous claim, and sanitized report compatibility still work.
- [ ] Outcome-first UI passes 320/375/768/1280, keyboard/focus, 200/400% zoom, reduced-motion, and touch-target checks.
- [ ] Website, pricing, sample, onboarding, Docs, Help, notifications, legal, metadata, and MCP setup match released behavior.
- [ ] Outcome/run/Flag/Verify/Watch/MCP/queue/notification/cost telemetry is available.
- [ ] Full verification, fresh migrations, security/dependency checks, production build, browser fixtures, immutable web/worker image, and exact-SHA canary pass.

## Explicit disposition

### What we are keeping

Site/Project tenancy, claim, Pages, `SiteOutcome`, Playwright, checks, Journeys, Audit/queue/evidence, Flags/Recommendations, Improvement history, Verify, Watch, notifications, Shopify, auth/passkeys, API keys/device flow, MCP HTTP/stdio foundations, billing, support/admin/telemetry, brand, and responsive Site shell.

### What we are changing

Outcome becomes the health unit; Journey becomes one execution mechanism; all triggers create one RunRequest; Flags attach to Outcomes where known; Home leads with Outcomes/attention; MCP is launch-critical and Site-scoped; remote auth becomes OAuth/scoped; deployment/Shopify become adapters; public positioning broadens while launch claims stay web-execution honest.

### What we are deliberately not building yet

A generic knowledge graph, new root System model, autonomous code changes, proprietary browser cloud, arbitrary test builder, enterprise test-management UI, raw run dashboard, integration marketplace, session replay, generalized agent-tool monitoring, irreversible commerce/refund execution, or every provider connection.

### What we are removing, and why

- New-product dependence on scores, rubrics, Finish Plans, review credits, Product workspace, and report Agent because they organize a one-time review, not watched Outcomes.
- Old MCP tools from discovery after a compatibility window because they expose reports and generic fix lists.
- The legacy public sample because it contradicts the Site/Outcome hierarchy.
- Repo-scan/fix-PR tools from launch MCP because they blur independent verifier versus acting agent.
- Duplicate routes only after redirects, access telemetry, and support evidence make removal safe.

No execution, evidence, history, connection, billing, or monitoring infrastructure is removed merely because its internal name is old.
