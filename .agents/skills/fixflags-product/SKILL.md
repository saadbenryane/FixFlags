---
name: fixflags-product
description: Route FixFlags product work to the Site vision, target behavior, migration, current access and billing contracts, shared application services and verification.
---

# FixFlags product

Read AGENTS.md and claim non-overlapping scope. Keep current implementation distinct from the new product target.

## Canonical routing

| Concern | Source |
| --- | --- |
| Accepted direction and phase | knowledge/vision.md, docs/product-architecture.md, docs/product-masterplan.md, ROADMAP.md |
| New behavior and interface | docs/product-prd.md, docs/workspace-interface.md |
| Existing code and reuse | PRODUCT.md, docs/site-v2-migration.md |
| Evidence and resolution | knowledge/evidence-rules.md |
| Current report compatibility | knowledge/report-contract.md |
| Capture and recovery | docs/audit-pipeline.md, lib/audit/ |
| Existing plans/access | lib/billing/plans.ts, lib/auth/entitlements.ts, SECURITY.md. Public list is `$49`/website/mo (Free weekly, Pro daily, Studio waitlist). Live Stripe IDs stay `$39`/`$129` until an explicit checkout pass. `STRIPE_PAID_OPEN` stays false. |
| Application commands/queries | lib/products/application/, lib/audit/application/ |
| Attempts and verification foundations | lib/improvements/, lib/audit/task-contracts.ts |
| Signals and Shopify foundations | lib/signals/, lib/shopify/, lib/integrity/ |
| Runtime and release | QUALITY.md, fixflags-runtime-release skill |
| Copy | lib/marketing/copy.ts, docs/voice-and-copy.md, docs/product-masterplan.md |

## Implementation discipline

Trace route, application service, persistence, tenancy, entitlements and UI together. Business facts and access are deterministic. Reuse shared services rather than creating separate report/Shopify/Site truths.

Outcome confirmation must align the visible promise and target with the execution binding. A broad inferred sentence does not become verified merely by selecting HTTP availability. Exercise edits through the command boundary: renaming an already confirmed Outcome must preserve its confirmation time, binding configuration and evidence. Keep browser runtime helpers separate from database-backed Outcome modules; type-only imports are safe, runtime imports can pull Prisma into the browser even when the build passes.

Customer-facing Outcome ↔ Flag links require persisted identity (`OutcomeAssessment.improvementId` or `Improvement.outcomeId`). Shared URL and check-name fragments are context, not proof of a relationship. If the identity is absent, keep the relationship unknown rather than inventing one.

Broad Site category evidence expires after eight days, one weekly Watch cycle plus a day of grace. Preserve the last checked time and open Flags, but do not show an old pass as current healthy coverage. Pass one explicit clock from the Site query into pure coverage and health calculations; tests must pin their clock.

Optional broad-health cards use progressive evidence, not a separate customization system. Keep Uptime and Accessibility hidden while they are untouched, then reveal them for anonymous and signed-in customers when the Site view carries concrete evidence or an open Flag. Carry the coverage fact explicitly into the board view so stale retained evidence remains visible and a first in-flight check does not create empty cards. A completed page capture plus metadata is point-in-time Uptime evidence; Accessibility is evidenced only by a completed applicable `module:accessibility` verifier receipt or a mapped Flag. `NOT_APPLICABLE` is not coverage.

Site route errors should retain a path back to the same Site and a separate All Sites escape. Use the route segment's error boundary and existing error-page component; avoid redirecting a customer to the legacy report or silently dropping Site context.

The public Analyze form checks the parsed URL hostname when rejecting a local destination. A word such as `localhost` in a public page path or query is not a local destination. The server's `normalizeAuditUrl` and resolved-address checks remain authoritative before any audit is queued.

Launch execution goes through `requestSiteRun` in `lib/sites/application/run-requests.ts`. Watch, deployment webhooks, MCP, and flag verification are adapters. A recorded fix does not change an assessment. Safe Signup stays Couldn’t verify until an authorized reversible fixture exists. MCP OAuth metadata, PKCE, audience, and scopes live in `lib/mcp/oauth.ts`. Do not describe that local engine as a deployed launch.

RunRequest lease reclamation is a conditional state transition, not a read-time decision. Candidate reads find expired or NULL leases, but the terminal `updateMany` must repeat that expiry predicate with the active status. A worker may renew between read and write; status alone is not authority to mark the run abandoned.

Absence-based recovery belongs to the parent Flag: the completed child proves the old observation is gone but contains no recovered row to link. When a Watch notification or other consumer needs proof, carry the exact parent Flag ID through `FlagDiffSummaryItem`; do not rematch `summary.fixed` against `child.flags`. Resolution proof reads must require a completed audit from the same customer Site, and customer copy must state what that dated check established rather than imply permanent current health.

Site connections are optional context. Search Console and Analytics attach to one Site, match the host, and store aggregates only. They never mark an Outcome Clear. Shopify remains the commerce connection. Do not claim a provider in public copy until its connect, mismatch, and disconnect path has been exercised.

The new Site replaces the report experience. Customer Flags use `isCustomerFlag` in `lib/audit/attention.ts`; Site lists come from `loadSiteFlags`. Home · Flags · Site settings is the nav. Signed-in owners with a Site redirect from `/report/[id]` to `/sites/{id}`. Shopify Can't buy upserts a Flag on a matching Site. Watch is weekly (Free) / daily (paid); pulse vs full is typed, hourly pulse is not scheduled. Existing rubrics, full update-review diff, anonymous gating and report URLs are scoped compatibility contracts, not permanent v2 requirements. Maintain current behavior until explicit migration and regression evidence.

Never reuse graph Site/Page as private customer objects or infer ownership from hostname alone. Preserve credentials, subscriptions, customer corrections and historical evidence.

Use the PRD acceptance scenarios for new Site work. Use the report contract for old report maintenance. Do not treat old screenshot/layout tests as the target design specification.

Run npm run agent -- verify --dry-run, appropriate checks and real-path verification. Documentation-only direction work needs source fidelity, routing, links and drift checks; it must not claim runtime completion.

Never ship fake progress, evidence, successful coverage, verified recovery, unsupported revenue claims or roadmap-only connections. External sends and consequential protective actions need user authorization.
