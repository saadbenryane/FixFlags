# Current product implementation

**Baseline inventory, 2026-09-08. Not the completed next version and not a production release attestation.**

The accepted destination is [the full vision](knowledge/vision.md). [ROADMAP.md](ROADMAP.md) and [the PRD](docs/product-prd.md) define upcoming implementation. This file describes reusable code and current compatibility behavior; it does not freeze the old experience.

## What exists in the workspace

| Area | Existing implementation | Boundary |
| --- | --- | --- |
| URL analysis | Audit worker, Playwright capture, deterministic checks, AI judgment, source evidence and persisted execution progress | Produces the existing analysis/report model; not yet the new Site dashboard |
| Customer persistence | Owned Project, productIntelligence, audit history, Improvement attempts and verification | Useful private foundations; not a complete inferred Outcome and Coverage system |
| Current report | /report/[id], report projections, ranked Flags, evidence and gated prompts | Legacy experience being replaced; details in [report contract](knowledge/report-contract.md) |
| Product workspace | /products/[id], history, attention, context and Watch controls | Existing interface, not Home · Flags · Site |
| Fix and comparison | Prompt handoff, attempt tracking, full update-review diff and independent verification receipts | “Not observed” differences are not verified repair; targeted Outcome verification needs new work |
| Monitoring | Project watch fields, scheduler/recovery, plan-gated scheduled reviews | Code still allows Free weekly Watch and meters `auditLimit` 3/30/90. Public packaging sells 24h vs hourly and does not advertise that pool. |
| Signals | Narrow ProductSignal path and observer foundation | Not a claim of full real-user health/Outcome monitoring |
| Shopify | Separate ShopifyShop / RevenuePath models, install/auth and integrity probes in ongoing workspace work | Not yet a unified customer Site connection; presence in the tree is not launch proof |
| Commercial foundation | Accounts, authentication, Stripe integration, plans, usage, checkout/waitlist and billing UI | Preserve records and access while deliberately migrating plan responsibility |
| Design | Shared brand tokens, UI primitives and evidence media | Preserve identity; replace old layout and product hierarchy |

Code orientation: [CODEMAP.md](CODEMAP.md), [ARCHITECTURE.md](ARCHITECTURE.md). Physical reuse and ownership risks: [migration design](docs/site-v2-migration.md).

## Existing compatibility contracts

The following apply to old routes until deliberately migrated. They are not future product requirements.

- Customer “product review” / “update review” maps to existing Audit execution and re-check routes. Manual update review is a fresh full capture diffed against its parent.
- Report rubrics are Message, Experience and Reach in existing check/scoring/report contracts. Their stored identifiers may remain internally; they do not limit the new Site's capabilities or navigation.
- Existing anonymous flow provides one teaser analysis with real public-safe evidence and deterministic progress. Fix prompt bodies, interactive Agent and private payloads remain server-gated until claim. Never persist signup strings as evidence.
- Authentication routes through /post-login so anonymous work can be claimed before checkout or onward navigation.
- Existing report access has public-safe evidence semantics distinct from private customer Project memory, connection data and actions. Do not propagate public report access into new Site ownership.
- Current HTTP boundaries include /api/checks, /api/reports/[id]/* and /api/products/[id]/signals. Shared application/task services own operations. New Site routes require explicit access and route-contract tests.
- Current Fix List / Finish Plan exports and existing CLI/MCP tool contracts remain compatibility behavior, not the new primary customer artifact. Power-user surfaces remain parked where the code parks them.

## Existing plans

Plan definitions in lib/billing/plans.ts and access checks in lib/auth/entitlements.ts are authoritative for current numbers and capabilities. They use FREE / BUILDER / TEAM internally and Free / Pro / Studio publicly. Enforcement still meters completed reviews against a monthly pool (3/30/90) and Product Watch remains schedule-gated in code. Public packaging on `/pricing` sells 24/7 monitoring: one free website every 24 hours, then `$49` per website per month up to every hour. Studio is volume, billed per website, never unlimited Sites. Paid CTAs request a demo. Stripe stays closed.

The new [strategy](knowledge/strategy.md) requires meaningful ongoing free care and paid responsibility. That is a planned entitlement and scheduling change, not something a new tagline or saved vision makes true. Preserve subscription IDs, historical usage and existing access until migration is explicit.

## Existing evidence and recovery

Deterministic and browser/network evidence must survive persistence with its source. AI interpretation cannot manufacture browser outcomes. Copying a prompt records handoff; attempts and fresh independent verification have separate outcomes. A comparison that no longer observes a finding is not by itself proof of recovery.

New customer certainty and coverage semantics are in [evidence rules](knowledge/evidence-rules.md). Adapters must preserve historical meaning; old enums should not be blindly relabeled Confirmed, Healthy or Resolved.

## Known gaps to the next version

The first analysis is not yet the permanent Home · Flags dashboard. Inferred editable Journeys, tenant-scoped page/action relationships, explicit coverage freshness, durable Flag projection, targeted behavior verification, same-Site Keep watching, useful free ongoing care, rare contextual alerts and unified Shopify context need implementation and acceptance evidence.

Public marketing, pricing, samples, how-it-works, metadata, support/help copy and Shopify materials contain mixed prior directions. The accepted customer-facing language is [docs/voice-and-copy.md](docs/voice-and-copy.md). Architecture: [docs/product-architecture.md](docs/product-architecture.md). Remaining surface-by-surface work is [docs/product-masterplan.md](docs/product-masterplan.md). They are tracked for capability-matched rollout, not declared reconciled by documentation. Do not advertise future connections or monitoring as shipped.

## Proof and operating status

Use [QUALITY.md](QUALITY.md), the actual changed code, focused evaluations and release receipts to determine readiness. The workspace contains substantial uncommitted work from multiple tasks. Git HEAD alone does not identify all of it, and local checks do not attest a deployed release.

Support, billing, auth and existing customer commands should continue to describe real current behavior until cutover. The [roadmap](ROADMAP.md) owns migration gates and successor priorities.
