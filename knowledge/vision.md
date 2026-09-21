# FixFlags product vision

**Accepted direction, 2026-09-21.** This replaces the narrower website-care framing while preserving its product and engineering foundation.

# FixFlags is the independent monitor for software that acts.

# Your software runs. FixFlags watches.

## The problem

Software is changing faster and acting more autonomously. Tests, logs, telemetry, coding agents, and the application itself are valuable, but they are not independent proof that an important result still works in the live system.

A deployment can succeed while Checkout breaks. An agent can finish a task while it changes the wrong object. A test can pass against a fixture while a real browser cannot complete Signup. The actor that made a change should not be the only actor that judges it.

Customers do not primarily need another testing dashboard. They need clear answers:

1. What matters?
2. Is it working now?
3. What went wrong?
4. What evidence proves that?
5. What needs to change?
6. Did the fix restore the outcome?

## The product

FixFlags independently watches the important outcomes a live product must deliver.

```text
Signup          Clear
Login           Clear
Checkout        Flag
Publish         Clear
Password reset  Couldn’t verify
```

Under those answers, FixFlags may use deterministic checks, real browsers, HTTP/API verification, integration signals, device runs, or later agent/MCP evaluators. These are execution mechanisms and evidence sources. They are not competing top-level products.

The core loop is:

# Flag → Fix → Verify

FixFlags keeps watching after verification. It works when a human opens the app, when a coding agent asks through MCP, after a deployment, when an integration emits a relevant event, and on its own schedule.

## The independent boundary

The software acts. FixFlags watches.

A human or coding agent may tell FixFlags what changed, which deployment to inspect, or which Outcome matters. It cannot tell FixFlags that the change succeeded. FixFlags executes its own verification, captures its own evidence, and reaches its own bounded conclusion.

```text
Agent changes software
  → agent asks FixFlags to verify Checkout
  → FixFlags independently executes the live Checkout binding
  → Clear, or Flag with evidence
  → agent fixes and deploys
  → FixFlags independently verifies again
```

The same independence applies to scheduled monitoring. MCP is an interface to the monitor, not the monitor itself.

## The permanent relationship

The customer adds a live product. At launch this remains a **Site**, backed by the existing owned Project model and URL-first experience. The first analysis becomes the persistent home; signup claims that same identity; Watch continues the relationship.

Do not create a new root domain object merely to sound broader. A Site can contain pages, APIs, commerce, browser journeys, connections, and machine-facing Outcomes. Introduce a broader root only when a real target cannot fit safely and cleanly.

## Outcomes are the unit of responsibility

An Outcome is an important result FixFlags is responsible for watching:

- a customer can sign up;
- a customer can log in;
- a customer can purchase;
- an editor can publish;
- password reset works;
- an API performs the expected operation;
- an MCP tool or agent task reaches the allowed final state.

The current `SiteOutcome` provides a useful identity and inference seed, but it is not yet a health model. It must gain a clear expectation, execution bindings, scope, assessment, freshness, evidence, and Flag/history relationships before it becomes the primary customer view. Adapt it in place. Do not create parallel Monitor, Objective, Task, or Test concepts without a concrete need.

A browser **Journey** is one way to execute a human-facing Outcome. It is not the universal abstraction. Checkout may use a Journey; an API Outcome may use an HTTP verifier; an agent Outcome may later use tool and final-state evaluators.

## Clear and Flag stay understandable

An Outcome can be:

- **Clear:** required evidence recently showed the expected result in the stated scope.
- **Flag:** something important did not behave as expected and warrants action.
- **Couldn’t verify:** required evidence was blocked, unsupported, missing, or incomparable.
- **Stale:** the last useful evidence is older than the monitoring policy.

No Flags does not mean Clear. One healthy low-level signal does not prove an Outcome. Coverage, scope, environment, and freshness remain visible enough to make trust warranted.

## Signals are not Outcomes

FixFlags preserves its breadth:

- page availability and uptime;
- security configuration;
- performance and mobile behavior;
- search access and metadata;
- accessibility essentials;
- tracking and measurement;
- commerce and integrations;
- browser and network behavior;
- page-level checks and Recommendations.

These signals may diagnose an Outcome, influence whether a failure matters, create a broader Product-health Flag, or remain useful depth. A broken HTTP check and “customers cannot Checkout” are related facts, not automatically the same abstraction.

Checks are infrastructure. Customers should not need to understand the test taxonomy before understanding their product.

## Flags remain the unit of attention

A Flag means something important that FixFlags watches is not behaving as expected. It connects the affected Outcome or Product responsibility, environment, execution, evidence, relevant checks, history, likely cause when known, fix context, and verification state.

Not every failed assertion becomes a Flag. Recommendations preserve useful lower-priority work without turning the product into an endless inbox. Importance is a product judgment grounded in evidence and Outcome criticality, not a severity enum alone.

One durable Flag accumulates occurrences. When the same failure returns, it reopens with new evidence instead of becoming an unrelated duplicate.

## Verification is product intelligence

Verification is not “the agent says done” and not merely “run any test again.” It preserves the lifecycle:

```text
Working
  → Flag detected
  → Fix attempted
  → independently Verified working again
  → later recurrence, if any
```

FixFlags should increasingly know what normal looked like, what failed, when it failed, what changed, which fix was attempted, what comparable execution ran, and how recovery was established. This knowledge emerges from real use; it is not a speculative graph project.

## One monitoring system, many triggers

Scheduled monitoring, UI actions, MCP calls, deployment events, API calls, integration events, and internal recovery all request work from the same tenant-scoped monitoring system.

They may select different Outcomes or provide different context, but they do not own separate engines or truth semantics. The existing Audit/queue/worker/browser pipeline remains the physical execution ledger underneath this shared command.

## MCP launches with the product

MCP is a launch channel for agentic development environments such as Codex, Claude Code, and Cursor. V1 is intentionally small but complete:

- connect to an owned Site;
- understand the Outcomes FixFlags watches;
- request an independent run;
- receive Clear or a Flag with evidence;
- inspect the Flag and success condition;
- record what was changed without self-certifying it;
- request independent verification again;
- retrieve the final result after disconnect or restart.

Existing MCP transport, authorization scaffolding, CLI bridge, device flow, editor configuration, and interaction telemetry are valuable. The report-era tool contract is not. Reuse the infrastructure and re-scope the surface around Sites, Outcomes, Runs, and Flags.

MCP must not turn FixFlags into a command-line testing product. Watch runs whether an agent is present or not.

## Human-facing and machine-facing software

Launch proves human-facing web Outcomes through existing browsers and checks, plus the MCP interaction loop that requests those independent executions.

The architecture also supports machine-facing Outcomes. The first practical extension is deterministic HTTP/API verification. Later, FixFlags may assess MCP servers and agents: tool discovery, callability, permission boundaries, intended action, affected object, and final real-world state.

General autonomous-agent evaluation is not a prerequisite for launch. It must grow from the same Outcome, evidence, Flag, and Verify contracts.

## The interface stays small

The application organizes around:

1. **What FixFlags is watching**
2. **What needs attention**

Outcome detail reveals evidence, history, diagnostics, and execution mechanics progressively. Broad Product health remains available underneath. There is no required Tests tab, raw Runs dashboard, or MCP control center.

Healthy FixFlags is intentionally quiet. A recent scoped Clear state and no interruption is success.

## Connections add context, not products

Shopify remains a connection and distribution wedge. Deployment providers supply triggers and change context. Analytics, Search Console, Meta, and future integrations should improve an existing Outcome or Flag rather than create disconnected dashboards.

Lost context becomes an explicit coverage gap. It does not make the core browser monitor unusable.

## Privacy and safety improve the product

FixFlags should collect the minimum needed to establish evidence. Public web execution stays behind SSRF-safe boundaries. Secrets remain encrypted and referenced, not copied into evidence. Inputs, cookies, private headers, and raw payloads do not become MCP context or analytics by default.

Protected, destructive, or irreversible Outcomes require explicit safe credentials, fixtures, permissions, and reset contracts. Until those exist, FixFlags says it could not verify rather than pretending.

## Infrastructure philosophy

Rent commodity models, browsers, devices, compute, networking, databases, and queues. Build proprietary infrastructure only when measured reliability, economics, intelligence, execution quality, security, or differentiation requires it.

The moat is not owning Chromium. It is knowing what matters, executing independently, preserving evidence and lifecycle, and learning what restores important Outcomes.

## What FixFlags deliberately does not become

- a one-time report product;
- a generic enterprise test-management dashboard;
- an uptime-only or SEO-only monitor;
- a browser Journey builder for every possible flow;
- a coding agent that edits and certifies its own work;
- an integration marketplace;
- a speculative knowledge graph;
- an autonomous-action platform before verification is trustworthy;
- a collection of separate engines for UI, Watch, MCP, and deployments.

## Product standard

A real customer can connect a live product, understand the important Outcomes, see Clear or a meaningful Flag, act with evidence, independently verify recovery, leave FixFlags watching, and use the same truth from the product UI or a coding agent.

The product is complete when that experience feels like one intentionally designed system and requires no explanatory workaround.
