---
name: fixflags-product-intelligence
description: FixFlags Product Intelligence System — vision, Product Intelligence model, Integrity Engine, Finish Plan, privacy, open-source strategy, and dimension-to-rubric mapping. Use when aligning features to the north star, designing PI persistence, Finish Plan ranking, or deciding what is aspirational vs shipped.
---

# FixFlags Product Intelligence

Read `AGENTS.md` first. Generate volatile facts from code and repository commands.

**Do not confuse vision with shipped product.** Shipped truth: `PRODUCT.md`. North star: `knowledge/vision.md`.

## Canonical homes (one concept each)

| Topic | File |
|-------|------|
| Vision narrative | `knowledge/vision.md` |
| Principles | `knowledge/foundations.md` |
| Customer PI model | `knowledge/product-intelligence.md` |
| Integrity Engine + 5 dimensions | `knowledge/integrity-engine.md` |
| Finish Plan artifact | `knowledge/finish-plan.md` |
| Report hierarchy | `knowledge/report-contract.md` |
| Privacy | `knowledge/privacy.md` |
| Open source | `knowledge/open-source.md` |
| Build order | `knowledge/execution.md` + `ROADMAP.md` |
| Durable bets | `DECISIONS.md` |

## Hard rules

1. **Core object is the Product**, not the audit URL alone.
2. **Canonical loop:** Observe → Understand → Judge → Improve → Verify → Learn. Customer wedge loop: Product Review → Fix → Verify → Watch; wedge mechanics remain Review → Fix → Update review.
3. **Three rubrics only in UI/scoring** (Message / Experience / Reach). Five integrity dimensions are engine framework until DECISIONS change.
4. **Customer PI ≠ growth graph.** `Project.productIntelligence` vs `lib/graph/` (`graph_*`).
5. **Never claim unshipped layers** (local OSS runtime, enterprise isolation, Agent Integrity checks) in marketing copy.
6. **Privacy:** FixFlags never learns your product; it learns how to understand products.
7. **Finish Plan ranking** uses `buildUnifiedPlanBundle` plus `buildFixList` for the complete ranked list; it is not a three-item truncation of the report.
8. **Review and Flag are observations.** The durable customer action object is the Product-scoped Improvement.
9. **No self-certification.** A builder declaration creates an Improvement Attempt; only a fresh child Review creates a verification outcome.
10. **Signals are senses, not analytics products.** Keep the schema narrow and treat correlations as `OBSERVED`.

## Implementation map (Phase 1+)

| Concern | Code |
|---------|------|
| Contract / PI types | `lib/audit/product-contract.ts`, `lib/audit/product-intelligence.ts` |
| Product persistence | Prisma `Project.productIntelligence`, `canonicalHost`, `isManaged`, and `productIntelligenceRevision` |
| Improvement history | Prisma `Improvement`, `ImprovementOccurrence`, `ImprovementAttempt`; `lib/improvements/service.ts` |
| Native Product Signals | Prisma `ProductSignal`, `ProductRelease`, `ProductSignalKey`; `lib/signals/`; `/api/products/[id]/signals`; `/fixflags.js` |
| Finish Plan service | `lib/audit/load-finish-plan-flags.ts`, `lib/audit/finish-plan.ts` |
| Canonical report | `AuditReport.tsx` on `/report/[id]`; `/details` redirects |
| Remember UI | `components/audit/ProductMemoryStrip.tsx` |
| Task contracts | `lib/audit/task-contracts.ts` (check → plan, re-check → diff + next plan) |
| Parked MCP / CLI | `lib/mcp/`, `fixflags-cli/` — undiscoverable; use `npm run agent -- context cli` |
| Remember on re-check | `reconcileImprovementVerification` → provenance-bearing `verifiedLearnings` only for `IMPROVED` attempts |
| Contract edit | `mergeContractIntoProductIntelligence` (never wipe memory) |
| Claim → Project | `lib/audit/claim-anonymous.ts` + `ensureProductProject` |
| Product watch | `lib/audit/project-watch.ts` + recovery-scheduler tick |

Anchor creation is concurrency-safe through the partial unique database index. Watch processing permits one active scheduled re-check per project and claims regression notification before sending.

## Shipped vs aspirational checklist

- **Shipped:** Contract, zero-to-three worthwhile Attention items, durable Improvements and attempts, independent verification receipts, provenance-bearing Remember, claim→Project, Product Watch, narrow native Product Signals, and task-shaped MCP/CLI context.
- **Not shipped:** portable PI export, five UI rubrics, white-label, CI Action, Vercel OAuth, Scout chat.

## Hard rules (additions)

11. **Contract PATCH merges** into existing PI. Never `productIntelligenceFromContract` alone when Project PI exists.
12. **Finish Plan transport prompts stay bounded.** `buildFinishPlan` remains one-to-three items for MCP/CLI. The web report shows the complete ranked Fix list via `buildFixList`.
13. **Remember must be visible** when learnings exist (`ProductMemoryStrip`). Do not claim Remember in PRODUCT.md without UI.
14. **Report order lives only in `knowledge/report-contract.md`.** Link to it; do not restate it in skills.
15. **Every transport uses task contracts.** UI, HTTP, watch, MCP, export, and CLI consume the same bounded Attention and independent verification receipt.
