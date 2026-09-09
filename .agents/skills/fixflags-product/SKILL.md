---
name: fixflags-product
description: Route FixFlags product work to the Site vision, target behavior, migration, current access and billing contracts, shared application services and verification.
---

# FixFlags product

Read AGENTS.md and claim non-overlapping scope. Keep current implementation distinct from the new product target.

## Canonical routing

| Concern | Source |
| --- | --- |
| Accepted direction and phase | knowledge/vision.md, ROADMAP.md |
| New behavior and interface | docs/product-prd.md, docs/workspace-interface.md |
| Existing code and reuse | PRODUCT.md, docs/site-v2-migration.md |
| Evidence and resolution | knowledge/evidence-rules.md |
| Current report compatibility | knowledge/report-contract.md |
| Capture and recovery | docs/audit-pipeline.md, lib/audit/ |
| Existing plans/access | lib/billing/plans.ts, lib/auth/entitlements.ts, SECURITY.md |
| Application commands/queries | lib/products/application/, lib/audit/application/ |
| Attempts and verification foundations | lib/improvements/, lib/audit/task-contracts.ts |
| Signals and Shopify foundations | lib/signals/, lib/shopify/, lib/integrity/ |
| Runtime and release | QUALITY.md, fixflags-runtime-release skill |
| Copy | lib/marketing/copy.ts, docs/voice-and-copy.md, docs/messaging-migration.md |

## Implementation discipline

Trace route, application service, persistence, tenancy, entitlements and UI together. Business facts and access are deterministic. Reuse shared services rather than creating separate report/Shopify/Site truths.

The new Site replaces the report experience. Existing rubrics, full update-review diff, anonymous gating and Studio Watch are scoped compatibility contracts, not permanent v2 requirements. Maintain current behavior until explicit migration and regression evidence. Useful free ongoing care needs real implementation.

Never reuse graph Site/Page as private customer objects or infer ownership from hostname alone. Preserve credentials, subscriptions, customer corrections and historical evidence.

Use the PRD acceptance scenarios for new Site work. Use the report contract for old report maintenance. Do not treat old screenshot/layout tests as the target design specification.

Run npm run agent -- verify --dry-run, appropriate checks and real-path verification. Documentation-only direction work needs source fidelity, routing, links and drift checks; it must not claim runtime completion.

Never ship fake progress, evidence, successful coverage, verified recovery, unsupported revenue claims or roadmap-only connections. External sends and consequential protective actions need user authorization.
