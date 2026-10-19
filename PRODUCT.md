---
status: supporting
authority: evidence
reviewed_at: 2026-10-09
supersedes: []
---

# Current product implementation

**Workspace implementation inventory, reconciled 2026-10-19. Not a production release attestation.**

The current release is the website app with one-website open-beta access. Websites leads to Site Overview, Timeline, Integrations, and Settings. Category evidence, pages, Outcomes, and diagnostics remain contextual depth. Automatic accounts and HTTP uptime are implemented locally, with controlled lifecycle and deployed proof still required. Settings and removal use tenant-scoped commands, and removal explicitly acknowledges unresolved external accounts. MCP, CLI, repository tools, and paid enrollment retain compatibility and the broader vision but are outside customer discovery and website release acceptance. The current requirement and proof status is recorded once in the [completion ledger](docs/product-masterplan.md#public-website-validation-completion-ledger).

The accepted destination is [the full vision](knowledge/vision.md). [ROADMAP.md](ROADMAP.md) and [the PRD](docs/product-prd.md) define upcoming implementation. This file describes reusable code and current compatibility behavior; it does not freeze the old experience.

## What exists in the workspace

| Area                  | Existing implementation                                                                                                                                    | Boundary                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| URL analysis          | Audit worker, Playwright capture, deterministic checks, AI judgment, source evidence and persisted execution progress                                      | Lands on a Site board. Legacy `/report/[id]` remains for public evidence; signed-in owners with a Site redirect there.                         |
| Customer persistence  | Owned Project (customer Site), adapted `SiteOutcome` with Checkout, page-availability, and version-authorized Safe Signup bindings/assessments, Flags via `isCustomerFlag`, Watch | Other inferred Outcomes remain descriptive until individually bound. Login and Password reset stay unavailable. Recommendations stay in card depth. |
| Current report        | /report/[id], report projections, ranked Flags, evidence and gated prompts                                                                                 | Private creator reports and preserved historical public-report compatibility                                                                   |
| Product workspace     | /sites/[id] Overview · Timeline · Integrations · Settings                                                                                                                   | Parked `/products/[id]` remains undiscoverable                                                                                                 |
| Fix and comparison    | Send a Flag to your AI, clipboard handoff, independent targeted Verify                                                                                     | Checkout-targeted Verify now enters the shared RunRequest path; other Flags retain the existing verifier. Absence is not Verified.            |
| Monitoring            | Scheduled full-site analysis with supported beta cadences, independent five-minute HTTP uptime, durable recovery and notification records, and production reliability and COGS projection | Paid access remains waitlisted until the production projection passes. Do not print 24h or hourly until pulse ships. 3/30/90 pool stays hidden. |
| Shopify               | Native install, purchase-path walks, Can buy / Can't buy. RED paths upsert a Flag on a matching Site                                                       | Connection, not a second product                                                                                                               |
| Signals               | Narrow ProductSignal path and observer foundation                                                                                                          | Supporting context only; not Outcome truth or full real-user monitoring.                                                                       |
| MCP/CLI               | SDK v2 stateless HTTP server with a legacy-client mode, nine registry-defined Site/Outcome/Run/Flag tools, OAuth discovery/scopes, API keys, device auth, stdio bridge, editor setup and interaction ledger | Local contract and authorization are implemented. Exact-client and production canary proof remain. |
| Commercial foundation | Accounts, authentication, Stripe integration, plans, usage, checkout/waitlist and billing UI                                                               | Preserve records and access while deliberately migrating plan responsibility                                                                   |
| Design                | Shared brand tokens, UI primitives and evidence media                                                                                                      | Shared homepage sample and owner workspace; preserve identity and compatibility surfaces                                                                                    |

Code orientation: [CODEMAP.md](CODEMAP.md), [ARCHITECTURE.md](ARCHITECTURE.md). Physical reuse and ownership risks: [migration design](docs/site-v2-migration.md).

## Existing compatibility contracts

The following apply to old routes until deliberately migrated. They are not future product requirements. The target hierarchy and MCP contract are in [product architecture](docs/product-architecture.md) and the [masterplan](docs/product-masterplan.md).

- Customer “product review” / “update review” maps to existing Audit execution and re-check routes. Manual update review is a fresh full capture diffed against its parent.
- Report rubrics are Message, Experience and Reach in existing check/scoring/report contracts. Their stored identifiers may remain internally; they do not limit the new Site's capabilities or navigation.
- Anonymous checks start private and provide one teaser analysis with real evidence and deterministic progress to the signed creator claim. Signup preserves the same Site and evidence under authenticated ownership. Historical public reports remain compatible. Fix prompt bodies, interactive Agent and private payloads remain server-gated until claim. Never persist signup strings as evidence.
- Authentication routes through /post-login so anonymous work can be claimed before checkout or onward navigation.
- Historical public reports retain their public-evidence access policy, distinct from private customer Project memory, connection data and actions. Do not propagate public report access into new Site ownership.
- Current HTTP boundaries include /api/checks, /api/reports/[id]/* and /api/products/[id]/signals. Shared application/task services own operations. New Site routes require explicit access and route-contract tests.
- Current Fix List / Finish Plan exports remain report compatibility behavior. Report-shaped MCP tools are no longer discovered; the Site/Outcome tools are the active contract. Legacy CLI commands remain hidden compatibility handlers while users are directed to the Outcome workflow.

## Existing plans

The workspace now applies the explicit open-beta policy in `lib/billing/beta-policy.ts`: resolved accounts receive all supported capabilities, full analysis depth, all supported monitoring schedules, and no commercial usage quotas. Free accounts can own one active website. Existing subscriber Site allowances, stored plans, Stripe prices, and purchased credits are preserved. Usage and cost records continue without consuming purchased credit packs during beta. Anonymous visitors retain the sign-in and claim boundaries.

Pricing displays Free, Pro, and Studio. Free is available during open beta. Planned paid prices are $49 and $99 per website per month, with waitlist actions and checkout closed throughout beta. Planned Studio hourly availability is distinct from daily browser verification. The beta promotion is temporary, and a useful Free plan is intended to remain after beta. These changes describe workspace behavior, not production release evidence.

## Existing evidence and recovery

Deterministic and browser/network evidence must survive persistence with its source. AI interpretation cannot manufacture browser outcomes. Copying a prompt records handoff; attempts and fresh independent verification have separate outcomes. A comparison that no longer observes a finding is not by itself proof of recovery.

New customer certainty and coverage semantics are in [evidence rules](knowledge/evidence-rules.md). Adapters must preserve historical meaning; old enums should not be blindly relabeled Confirmed, Healthy or Resolved.

## Known gaps to the next version

Implemented and locally verified in the Outcome slice: additive Checkout, availability, and Safe Signup binding and assessment; one tenant-scoped RunRequest path entered by every trigger (UI, Watch, MCP, deployment, API, Shopify, internal); independent browser purchase and reversible Safe Form execution; Clear/Flag/Couldn't verify/Stale projection; durable Flag linkage; append-only binding attempts so a retry cannot erase a prior failure; complete Outcome responsibility detail; per-Outcome pause/enable; cadence-derived freshness; and developer keys/CLI/MCP setup and tools. Newly created developer keys now default to read-only evidence, require an explicit 30/90/365-day lifetime, and enforce their permission set for stdio/API-key clients as well as OAuth clients; CLI device approval creates a 90-day full-workflow key. Historical empty-scope keys remain compatible and are labeled as legacy full access until replaced or revoked. Safe Signup requires a tenant-owned, exact-origin fixture whose reset, submit, assertion, and cleanup sequence passed a dry run before authorization. Fixture and secret changes revoke that authorization. Login and Password reset remain unavailable. The existing broad Site checks and legacy report compatibility remain. This is not yet a deployed-customer claim. The proof for each claim, and the gates that remain open, are in the [release evidence runbook](docs/release-evidence-runbook.md).

Website-beta acceptance still requires the final frozen foundation, repeated public precision review, credentialed browser repair and recurrence, automatic-account lifecycle, private-storage isolation, provider notification delivery, rendered experience and naturally scheduled production monitoring. The completion ledger distinguishes implementation, local proof and deployed proof. Automatic accounts remain disabled in production until their lifecycle gate is proven.

External Codex, Claude Code and Cursor sessions, additional integration activation and paid opening remain outside website-beta acceptance. The 14-day and 100-scheduled-execution production reliability and COGS window belongs to paid opening and remains computed by `npm run watch:launch-readiness`. Its readout distinguishes passed, failed, collecting and unavailable evidence and never opens access automatically. MCP discovery, paid activation, Login and Password reset retain their separate evidence gates.

Do not advertise Meta, repository scanning, or hourly Watch as shipped. GitHub account authorization is available by owner direction. All other customer integrations are coming soon until testing and validation. Retained Shopify and Google implementations and cleanup remain internal compatibility capabilities. Public GitHub copy describes account authorization and Flag handoff. Repository scanning and automatic pull requests remain parked.

## Proof and operating status

Use [QUALITY.md](QUALITY.md), the actual changed code, focused evaluations and the current [completion ledger](docs/product-masterplan.md#public-website-validation-completion-ledger) to determine readiness. Historical candidate checks cannot certify the current source or deployment. The active private ledger is selected by `test-results/release/website-beta-current.json`.

Outcome commands, queries, synchronization, binding construction and individual binding executors have separate owners behind their existing compatibility entry points. Native HTTP decision inputs retain hashed request identity and typed response facts for exact replay, excluding raw destination URLs, response bodies and credential-bearing headers. New prescription tasks freeze source and guidance fingerprints, compare exact membership at commit, and retain an atomic replay receipt. Changed source and missing historical scope are explicit failures. Provider attempts are admitted before external requests and measured responses are recorded before parsing and quality validation. Attempts without a retained response remain unpriced, including cancellation and ownership loss. Planner and evaluator consumption belongs to the initial-analysis subtotal, with separate durable phase records. New journey plans request implemented read-only actions against observed targets; planning expectations cannot establish observations. Prescription configuration is independent of triage and chat, with unchanged quality gates and conditional guidance for qualitative reviews. These are workspace contracts whose final candidate and deployed evidence must be recorded separately.

Support, billing, auth and existing customer commands should continue to describe real current behavior until cutover. The [roadmap](ROADMAP.md) owns migration gates and successor priorities.
