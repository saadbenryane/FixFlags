# FixFlags roadmap

**Direction accepted 2026-09-21. Planning only; not a shipped-capability claim.**

FixFlags is the independent monitor for software that acts. **Your software runs. FixFlags watches.**

The authoritative implementation detail, capability mapping, MCP contract, migration, and launch checklist live in [docs/product-masterplan.md](docs/product-masterplan.md). This file is the dependency-ordered delivery view. Current code truth remains [PRODUCT.md](PRODUCT.md).

## Architectural spine

```text
Owned Product / Site (physical Project)
  → Outcomes that matter (adapt current SiteOutcome)
    → execution methods (checks, browser Journeys, HTTP/API, integrations)
      → independent Outcome assessment (Clear / Flag / Couldn’t verify / Stale)
        → evidence, Flag lifecycle, fixes, verification, history and diagnostics
```

All initiators use one tenant-scoped run command:

```text
schedule | human UI | MCP | deployment | API | integration | FixFlags logic
                                  ↓
                    idempotent RunRequest + planner
                                  ↓
            existing Audit / queue / worker / browser engine
                                  ↓
              Outcome assessments + Flags + notifications
```

This is evolution, not replacement. `Project`, `Audit`, Playwright, checks, JourneyReview, Flags, Improvement history, Watch, Shopify, auth, billing, and MCP transport are reused. `SiteOutcome` is not promoted unchanged: its current descriptive semantics must be strengthened and proven before it becomes the primary health projection. No parallel Monitor, Task, Objective, or new System root is planned.

## Launch milestone: independent monitoring with MCP

The first public milestone is one complete loop, not a collection of foundations:

**change → verify → Flag → fix → verify → Clear**

It includes scheduled monitoring that runs with no agent present and a coding-agent path that uses the same engine.

### Gate 0: contract and migration safety

**Deliver**

- Additive Outcome expectation/binding/assessment and RunRequest contracts.
- Explicit distinction between Outcome health and raw signal/category health.
- Tenant, idempotency, target-origin, evidence, and compatibility rules.
- Backfill/shadow-read plan for existing Sites, Outcomes, Audits, Flags, Watch, and Shopify.

**Exit evidence**

- Fresh and upgraded migration rehearsals.
- Two accounts may monitor the same hostname without data crossover.
- Existing Site/Watch/Flag paths stay green.
- One existing Outcome is projected without inventing an expectation or pass.

### Gate 1: Checkout vertical slice

**Deliver**

- Adapt an existing Checkout/purchase `SiteOutcome` with a browser Journey binding.
- Common RunRequest from Site UI, targeted Verify, and schedule.
- Clear/Flag/Couldn’t verify/Stale projection with freshness and limitations.
- Stable Flag occurrence, record-fix, independent Verify, recovery, and recurrence history.
- Existing Shopify purchase path can contribute to the same Outcome/Flag when connected.

**Exit evidence**

- Controlled fixture: Clear → induced failure → one Flag → failed Verify → fix → comparable Clear → recurrence.
- Same result survives worker restart, duplicate submission, refresh, and delayed queue.
- Technical check failure remains diagnostic unless the Outcome success condition actually fails.

### Gate 2: one execution path for every launch trigger

**Deliver**

- Migrate Watch, manual UI, MCP, Railway deployment, public API, Shopify, and internal retry to the common Site application command.
- Trigger context records actor, reason, requested Outcomes, deployment/commit, environment, and idempotency key without influencing verdict.
- Existing Audit stays the internal physical run ledger.

**Exit evidence**

- Contract tests prove equivalent selection/ownership/reconciliation across triggers.
- Schedule continues when MCP is disconnected.
- Retry/duplicate events produce one active RunRequest and one final assessment set.

### Gate 3: MCP end-to-end launch

**Deliver**

- Outcome-shaped v1 tools/resources from the masterplan, backed only by the Site application boundary.
- OAuth 2.1 protected-resource discovery, scopes and audience binding for remote clients.
- Scoped/revocable API keys and device authorization for CI and local stdio bridge.
- Fast run creation plus durable polling; optional MCP Tasks only when negotiated.
- One-command setup for Codex, Claude Code, Cursor, and generic MCP clients.
- Report-era tools remain temporary adapters but disappear from new discovery/docs.

**Exit evidence**

- On an owned Site, each tested coding agent can list watched Outcomes, request Checkout verification, receive a Flag with evidence, record the deployed fix, verify again, and receive Clear.
- Disconnect/restart during execution resumes from the same run ID.
- Cross-tenant, arbitrary-host, insufficient-scope, revoked-key, rate-limit, worker-down, blocked-target, and incomparable-evidence cases fail safely.
- The agent’s “fixed” claim never changes Outcome or Flag state.

### Gate 4: human product hierarchy and breadth

**Deliver**

- Home leads with watched Outcomes and Needs attention; category health remains beneath it.
- Outcome detail owns expectation, current assessment, freshness, evidence, Flags, executions, and history.
- Pages, Security, Search, Performance, Tracking, Uptime, Accessibility, commerce and Recommendations remain useful broader health/diagnostic signals.
- Site Settings owns Outcomes, Watch, notifications, connections, and developer/MCP access.
- Safe Signup/form and availability Outcome patterns join Checkout.

**Exit evidence**

- A non-technical user can answer what matters, whether it works, what failed, what proves it, what to change, and whether recovery was verified.
- 320/375/768/1280 px, keyboard/focus, 200/400% zoom, reduced-motion, and practical touch-target checks pass.
- No Clear state derives merely from zero Flags or a passing low-level signal.

### Gate 5: public coherence and operations

**Deliver**

- Homepage, onboarding, pricing, sample, Docs, Help, MCP reference, emails, notifications, legal, metadata, changelog, errors, and support align to the released model.
- Replace the legacy public report sample with an Outcome-first Site proof.
- Outcome/run/MCP/Watch/notification/cost observability and admin views.
- Exact-SHA production canary with web and worker from the same image/digest.

**Exit evidence**

- Public route/copy contract has no report-era product promises or parked MCP dead ends.
- Full verification, migration, build, security/dependency, browser fixture, client matrix, scheduler restart, email sink, and rollback rehearsal pass.
- Production completes the new-user human path and the coding-agent loop on dedicated canary accounts.

## Parallel work after Gate 0

| Track            | May proceed in parallel                                     | Must converge on                           |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------ |
| Outcome/runtime  | Checkout binding, RunRequest planner, assessment projection | Checkout fixture and Site command contract |
| MCP              | OAuth/scopes, tool schemas, resources, CLI/client adapters  | Same Site command and Outcome projections  |
| Human UI         | Outcome-first Home/detail/settings states                   | Same projections; no mock health logic     |
| Trigger adapters | Watch, Railway, Shopify and API adapters                    | Same RunRequest/idempotency contract       |
| Public/docs      | Draft copy, IA, examples and reference                      | Only behavior proven by Gates 1–4          |
| Operations       | telemetry, cost, security and canary tooling                | Same run/assessment identifiers            |

## Immediately after launch

- Add deterministic HTTP/API Outcome bindings for machine-facing software.
- Add deployment providers and changed-area selection.
- Add safe authenticated browser Outcomes with explicit fixture/reset contracts.
- Adopt MCP Tasks/subscriptions where actual clients support them.
- Improve environment comparison, dependency context, and cost-based paid readiness.

## Later, without delaying launch

- Monitor MCP servers, agent tools, and autonomous workflows for discovery, permission, intended side effect, and final real-world state.
- Sandboxed evaluation for irreversible actions such as refunds.
- Additional context integrations, custom Outcome builders, team collaboration, public Flag grants, and richer cross-system knowledge.
- Build proprietary browser/runtime infrastructure only when measured economics, reliability, security, or execution quality requires it.

## Explicit non-goals for the launch milestone

- No replacement of the working Audit/worker/browser engine.
- No new root System/Monitor/Test/Task domain hierarchy.
- No generic enterprise test-management UI or raw run dashboard.
- No autonomous repository edits or agent-certified success.
- No requirement to solve generalized autonomous-agent evaluation before shipping MCP.
- No deletion of broad page/security/search/performance/tracking/accessibility evidence because it is not a Journey.
- No public claim for machine-facing Outcomes until a real adapter passes the same evidence rules.

## Release honesty

Documentation may describe TARGET architecture. Marketing may describe only SHIPPED behavior. A schema migration, exposed MCP endpoint, or passing unit test does not complete this roadmap. Launch requires the end-to-end evidence in Gates 0–5 on one exact production revision.
