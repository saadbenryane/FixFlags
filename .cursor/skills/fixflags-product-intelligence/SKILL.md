---
name: fixflags-product-intelligence
description: FixFlags Product Intelligence System — vision, Product Intelligence model, Integrity Engine, Finish Plan, privacy, open-source strategy, and dimension↔rubric mapping. Use when aligning features to the north star, designing PI persistence, Finish Plan ranking, or deciding what is aspirational vs shipped.
---

# FixFlags Product Intelligence

**Read [`AGENTS.md`](../../AGENTS.md) first.** Volatile counts live only in AGENTS.md Project facts.

**Do not confuse vision with shipped product.** Shipped truth: [`PRODUCT.md`](../../PRODUCT.md). North star: [`knowledge/vision.md`](../../knowledge/vision.md).

## Canonical homes (one concept each)

| Topic | File |
|-------|------|
| Vision narrative | `knowledge/vision.md` |
| Principles | `knowledge/foundations.md` |
| Customer PI model | `knowledge/product-intelligence.md` |
| Integrity Engine + 5 dimensions | `knowledge/integrity-engine.md` |
| Finish Plan artifact | `knowledge/finish-plan.md` |
| Privacy | `knowledge/privacy.md` |
| Open source | `knowledge/open-source.md` |
| Build order | `knowledge/execution.md` + `ROADMAP.md` |
| Durable bets | `DECISIONS.md` |

## Hard rules

1. **Core object is the Product**, not the audit URL alone.
2. **Loop:** Understand → Improve → Verify → Remember. Wedge UX remains Flag → Fix → Re-check.
3. **Three rubrics only in UI/scoring** (Message / Experience / Reach). Five integrity dimensions are engine framework until DECISIONS change.
4. **Customer PI ≠ growth graph.** `Project.productIntelligence` vs `lib/graph/` (`graph_*`).
5. **Never claim unshipped layers** (local OSS runtime, enterprise isolation, Agent Integrity checks) in marketing copy.
6. **Privacy:** FixFlags never learns your product; it learns how to understand products.
7. **Finish Plan ≤3** highest-leverage items; not a backlog dump.

## Implementation map (Phase 1+)

| Concern | Code |
|---------|------|
| Contract / PI types | `lib/audit/product-contract.ts`, `lib/audit/product-intelligence.ts` |
| Project PI column | Prisma `Project.productIntelligence` |
| Finish Plan ranking | `lib/audit/priority-flags.ts` |
| Report Finish Plan UI | `components/audit/AuditReport.tsx` `#report-finish-plan` |
| MCP | `get_product_context`, `get_current_finish_plan` (+ existing tools) |
| Remember on re-check | finalize / monitoring + PI verifiedLearnings |

## When updating docs

- Put new vision content only in `knowledge/vision.md`.
- Update `PRODUCT.md` only for shipped behavior.
- Point skills and AGENTS to canon; do not duplicate the vision narrative.
