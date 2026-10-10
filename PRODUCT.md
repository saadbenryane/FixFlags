---
status: supporting
authority: evidence
reviewed_at: 2026-10-09
supersedes: []
---

# Current product implementation

**Workspace implementation inventory, reconciled 2026-10-06. Not a production release attestation.**

The accepted destination is [the full vision](knowledge/vision.md). [ROADMAP.md](ROADMAP.md) and [the PRD](docs/product-prd.md) define upcoming implementation. This file describes reusable code and current compatibility behavior; it does not freeze the old experience.

## What exists in the workspace

| Area                  | Existing implementation                                                                                                                                    | Boundary                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| URL analysis          | Audit worker, Playwright capture, deterministic checks, AI judgment, source evidence and persisted execution progress                                      | Lands on a Site board. Legacy `/report/[id]` remains for public evidence; signed-in owners with a Site redirect there.                         |
| Customer persistence  | Owned Project (customer Site), adapted `SiteOutcome` with Checkout, page-availability, and version-authorized Safe Signup bindings/assessments, Flags via `isCustomerFlag`, Watch | Other inferred Outcomes remain descriptive until individually bound. Login and Password reset stay unavailable. Recommendations stay in card depth. |
| Current report        | /report/[id], report projections, ranked Flags, evidence and gated prompts                                                                                 | Compatibility for public evidence and anonymous teasers                                                                                        |
| Product workspace     | /sites/[id] Home · Flags · Site settings                                                                                                                   | Parked `/products/[id]` remains undiscoverable                                                                                                 |
| Fix and comparison    | Send a Flag to your AI, clipboard handoff, independent targeted Verify                                                                                     | Checkout-targeted Verify now enters the shared RunRequest path; other Flags retain the existing verifier. Absence is not Verified.            |
| Monitoring            | Project Watch: Free weekly full, paid daily full; durable scheduling/recovery/notification records; 14-day/100-run reliability and COGS projection | Paid access remains waitlisted until the production projection passes. Do not print 24h or hourly until pulse ships. 3/30/90 pool stays hidden. |
| Shopify               | Native install, purchase-path walks, Can buy / Can't buy. RED paths upsert a Flag on a matching Site                                                       | Connection, not a second product                                                                                                               |
| Signals               | Narrow ProductSignal path and observer foundation                                                                                                          | Supporting context only; not Outcome truth or full real-user monitoring.                                                                       |
| MCP/CLI               | SDK v2 stateless HTTP server with a legacy-client mode, nine registry-defined Site/Outcome/Run/Flag tools, OAuth discovery/scopes, API keys, device auth, stdio bridge, editor setup and interaction ledger | Local contract and authorization are implemented. Exact-client and production canary proof remain. |
| Commercial foundation | Accounts, authentication, Stripe integration, plans, usage, checkout/waitlist and billing UI                                                               | Preserve records and access while deliberately migrating plan responsibility                                                                   |
| Design                | Shared brand tokens, UI primitives and evidence media                                                                                                      | Preserve identity; replace old layout and product hierarchy                                                                                    |

Code orientation: [CODEMAP.md](CODEMAP.md), [ARCHITECTURE.md](ARCHITECTURE.md). Physical reuse and ownership risks: [migration design](docs/site-v2-migration.md).

## Existing compatibility contracts

The following apply to old routes until deliberately migrated. They are not future product requirements. The target hierarchy and MCP contract are in [product architecture](docs/product-architecture.md) and the [masterplan](docs/product-masterplan.md).

- Customer “product review” / “update review” maps to existing Audit execution and re-check routes. Manual update review is a fresh full capture diffed against its parent.
- Report rubrics are Message, Experience and Reach in existing check/scoring/report contracts. Their stored identifiers may remain internally; they do not limit the new Site's capabilities or navigation.
- Existing anonymous flow provides one teaser analysis with real public-safe evidence and deterministic progress. Fix prompt bodies, interactive Agent and private payloads remain server-gated until claim. Never persist signup strings as evidence.
- Authentication routes through /post-login so anonymous work can be claimed before checkout or onward navigation.
- Existing report access has public-safe evidence semantics distinct from private customer Project memory, connection data and actions. Do not propagate public report access into new Site ownership.
- Current HTTP boundaries include /api/checks, /api/reports/[id]/* and /api/products/[id]/signals. Shared application/task services own operations. New Site routes require explicit access and route-contract tests.
- Current Fix List / Finish Plan exports remain report compatibility behavior. Report-shaped MCP tools are no longer discovered; the Site/Outcome tools are the active contract. Legacy CLI commands remain hidden compatibility handlers while users are directed to the Outcome workflow.

## Existing plans

Plan definitions in lib/billing/plans.ts and access checks in lib/auth/entitlements.ts are authoritative for current numbers and capabilities. They use FREE / BUILDER / TEAM internally and Free / Pro / Studio publicly. Enforcement still meters completed reviews against a monthly pool (3/30/90) and Product Watch remains schedule-gated in code (Free weekly, Pro/Studio daily). Public packaging on `/pricing` sells per-site monitoring: one free website verified weekly, then `$49` per website per month verified every day. Studio is volume, billed per website, never unlimited Sites. Paid CTAs join the waitlist. Stripe stays closed.

The new [strategy](knowledge/strategy.md) requires meaningful ongoing free care and paid responsibility. That is a planned entitlement and scheduling change, not something a new tagline or saved vision makes true. Preserve subscription IDs, historical usage and existing access until migration is explicit.

## Existing evidence and recovery

Deterministic and browser/network evidence must survive persistence with its source. AI interpretation cannot manufacture browser outcomes. Copying a prompt records handoff; attempts and fresh independent verification have separate outcomes. A comparison that no longer observes a finding is not by itself proof of recovery.

New customer certainty and coverage semantics are in [evidence rules](knowledge/evidence-rules.md). Adapters must preserve historical meaning; old enums should not be blindly relabeled Confirmed, Healthy or Resolved.

## Known gaps to the next version

Implemented and locally verified in the Outcome slice: additive Checkout, availability, and Safe Signup binding and assessment; one tenant-scoped RunRequest path entered by every trigger (UI, Watch, MCP, deployment, API, Shopify, internal); independent browser purchase and reversible Safe Form execution; Clear/Flag/Couldn't verify/Stale projection; durable Flag linkage; append-only binding attempts so a retry cannot erase a prior failure; complete Outcome responsibility detail; per-Outcome pause/enable; cadence-derived freshness; and developer keys/CLI/MCP setup and tools. Newly created developer keys now default to read-only evidence, require an explicit 30/90/365-day lifetime, and enforce their permission set for stdio/API-key clients as well as OAuth clients; CLI device approval creates a 90-day full-workflow key. Historical empty-scope keys remain compatible and are labeled as legacy full access until replaced or revoked. Safe Signup requires a tenant-owned, exact-origin fixture whose reset, submit, assertion, and cleanup sequence passed a dry run before authorization. Fixture and secret changes revoke that authorization. Login and Password reset remain unavailable. The existing broad Site checks and legacy report compatibility remain. This is not yet a deployed-customer claim. The proof for each claim, and the gates that remain open, are in the [release evidence runbook](docs/release-evidence-runbook.md).

Launch gaps: deploy the candidate exact SHA; prove the complete Checkout and Safe Signup recovery loops with credentialed web, Watch, and external Codex, Claude Code, and Cursor clients; complete live sandbox journeys for advertised connections; finish the 14-day and 100-scheduled-execution reliability and COGS window now computed from durable production records by `npm run watch:launch-readiness`; register the GA4 dimension and capture a fresh attribution baseline; and finish production observability and public coherence. The Watch readout distinguishes passed, failed, collecting, and unavailable evidence and does not open access by itself. MCP discovery, public setup claims, paid activation, Login, and Password reset stay closed until their named evidence gates pass. Extra connections and generalized agent-task evaluation remain post-launch.

Do not advertise Meta, repository scanning, or hourly Watch as shipped. Analytics and Search Console connect in Site settings and add context only. Public GitHub copy is sign-in and Flag handoff, not a repository scan.

## Proof and operating status

Use [QUALITY.md](QUALITY.md), the actual changed code, focused evaluations and
release receipts to determine readiness. The workspace was clean after local
candidate `0e155da3f0b340c22cf84ba7ce555301061267dd` was committed. Its final
full verification passed, but the exact-SHA foundation receipt is `BLOCKED`
because the disposable release database, container environment file, and
explicit reset authorization are absent. Production still requires a fresh
deployed-SHA check. Git history and local checks do not attest a deployed
release.

Support, billing, auth and existing customer commands should continue to describe real current behavior until cutover. The [roadmap](ROADMAP.md) owns migration gates and successor priorities.
