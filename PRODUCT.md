# Current product implementation

**Baseline inventory, 2026-09-08. Not the completed next version and not a production release attestation.**

The accepted destination is [the full vision](knowledge/vision.md). [ROADMAP.md](ROADMAP.md) and [the PRD](docs/product-prd.md) define upcoming implementation. This file describes reusable code and current compatibility behavior; it does not freeze the old experience.

## What exists in the workspace

| Area | Existing implementation | Boundary |
| --- | --- | --- |
| URL analysis | Audit worker, Playwright capture, deterministic checks, AI judgment, source evidence and persisted execution progress | Lands on a Site board. Legacy `/report/[id]` remains for public evidence; signed-in owners with a Site redirect there. |
| Customer persistence | Owned Project (customer Site), inferred Journeys (Outcome model), Flags via `isCustomerFlag`, Watch | Recommendations stay in card depth. 0 Flags is not healthy without coverage. |
| Current report | /report/[id], report projections, ranked Flags, evidence and gated prompts | Compatibility for public evidence and anonymous teasers |
| Product workspace | /sites/[id] Home · Flags · Site settings | Parked `/products/[id]` remains undiscoverable |
| Fix and comparison | Send a Flag to your AI, clipboard handoff, independent Verify | Absence is not Verified |
| Monitoring | Project watch: Free weekly full, paid daily full. Pulse vs full types exist; hourly pulse is not scheduled until costed. | Do not print 24h or hourly until pulse ships. 3/30/90 pool stays hidden. |
| Shopify | Native install, purchase-path walks, Can buy / Can't buy. RED paths upsert a Flag on a matching Site | Connection, not a second product |
| Signals | Narrow ProductSignal path and observer foundation | Not a claim of full real-user Journey monitoring |
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

Plan definitions in lib/billing/plans.ts and access checks in lib/auth/entitlements.ts are authoritative for current numbers and capabilities. They use FREE / BUILDER / TEAM internally and Free / Pro / Studio publicly. Enforcement still meters completed reviews against a monthly pool (3/30/90) and Product Watch remains schedule-gated in code (Free weekly, Pro/Studio daily). Public packaging on `/pricing` sells per-site monitoring: one free website verified weekly, then `$49` per website per month verified every day. Studio is volume, billed per website, never unlimited Sites. Paid CTAs join the waitlist. Stripe stays closed.

The new [strategy](knowledge/strategy.md) requires meaningful ongoing free care and paid responsibility. That is a planned entitlement and scheduling change, not something a new tagline or saved vision makes true. Preserve subscription IDs, historical usage and existing access until migration is explicit.

## Existing evidence and recovery

Deterministic and browser/network evidence must survive persistence with its source. AI interpretation cannot manufacture browser outcomes. Copying a prompt records handoff; attempts and fresh independent verification have separate outcomes. A comparison that no longer observes a finding is not by itself proof of recovery.

New customer certainty and coverage semantics are in [evidence rules](knowledge/evidence-rules.md). Adapters must preserve historical meaning; old enums should not be blindly relabeled Confirmed, Healthy or Resolved.

## Known gaps to the next version

Shipped in this cut: Analyze → Site board, customer Flag projector, Home · Flags · Site settings, Send a Flag to your AI, independent Verify, weekly/daily Watch honesty, URL-first legal, Shopify Can't buy as a Site Flag when a matching Site exists, signed-in owner report redirect.

Later: hourly pulse, FixFlags Agent FAB, MCP as a customer surface, extra connections (Meta, Analytics, Search Console, deploys), and deleting the report runtime. Public copy must not claim those.

Do not advertise future connections or hourly Watch as shipped.

## Proof and operating status

Use [QUALITY.md](QUALITY.md), the actual changed code, focused evaluations and release receipts to determine readiness. The workspace contains substantial uncommitted work from multiple tasks. Git HEAD alone does not identify all of it, and local checks do not attest a deployed release.

Support, billing, auth and existing customer commands should continue to describe real current behavior until cutover. The [roadmap](ROADMAP.md) owns migration gates and successor priorities.
