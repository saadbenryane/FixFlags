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
2. **Canonical loop:** Signal → Understand → Prioritize → Fix → Verify → Learn. Customer wedge loop: Check → Fix → Verify → Watch; wedge mechanics remain Flag → Fix → Update review.
3. **Three rubrics only in UI/scoring** (Message / Experience / Reach). Five integrity dimensions are engine framework until DECISIONS change.
4. **Customer PI ≠ growth graph.** `Project.productIntelligence` vs `lib/graph/` (`graph_*`).
5. **Never claim unshipped layers** (local OSS runtime, enterprise isolation, Agent Integrity checks) in marketing copy.
6. **Privacy:** FixFlags never learns your product; it learns how to understand products.
7. **Finish Plan ≤3** highest-leverage items; not a backlog dump.

## Implementation map (Phase 1+)

| Concern | Code |
|---------|------|
| Contract / PI types | `lib/audit/product-contract.ts`, `lib/audit/product-intelligence.ts` |
| Product persistence | Prisma `Project.productIntelligence`, `canonicalHost`, `isManaged`, and `productIntelligenceRevision` |
| Finish Plan service | `lib/audit/finish-plan.ts` (`buildFinishPlan`) |
| Focused report / details | `FocusedAuditReport.tsx`; `AuditReport.tsx` on `/details` |
| Remember UI | `components/audit/ProductMemoryStrip.tsx` |
| Task contracts | `lib/audit/task-contracts.ts` (check → plan, re-check → diff + next plan) |
| MCP | `ff_check_and_plan`, `ff_recheck_and_compare`, plus context/plan drill-down tools |
| Agent CLI | `fixflags-cli/`: `check` → Finish Plan ≤3; `recheck` → verification diff + next plan |
| Remember on re-check | `diffFlagsAgainstParent` → `verifiedLearnings` |
| Contract edit | `mergeContractIntoProductIntelligence` (never wipe memory) |
| Claim → Project | `lib/audit/claim-anonymous.ts` + `ensureProductProject` |
| Product watch | `lib/audit/project-watch.ts` + recovery-scheduler tick |

Anchor creation is concurrency-safe through the partial unique database index. Watch processing permits one active scheduled re-check per project and claims regression notification before sending.

## Shipped vs aspirational checklist

- **Shipped:** Contract, Finish Plan ≤3, Remember writes + UI, claim→Project, Project watch, task-shaped agent CLI.
- **Not shipped:** portable PI export, five UI rubrics, white-label, CI Action, Vercel OAuth, Scout chat.

## Hard rules (additions)

8. **Contract PATCH merges** into existing PI. Never `productIntelligenceFromContract` alone when Project PI exists.
9. **Finish Plan copy/export/MCP plan prompt ≤3** by default. "All prompts" is a separate labeled export.
10. **Remember must be visible** when learnings exist (`ProductMemoryStrip`). Do not claim Remember in PRODUCT.md without UI.
11. **Report order lives only in `knowledge/report-contract.md`.** Link to it; do not restate it in skills.
12. **Every transport uses task contracts.** UI, HTTP, watch, MCP, export, and CLI consume the same bounded Finish Plan and parent verification diff.
