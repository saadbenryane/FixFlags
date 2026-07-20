# Session: product-intelligence-vision

**Date:** 2026-07-20  
**Agent:** auto  
**Branch:** main

## Done

- Canonized Product Intelligence vision under `knowledge/` (vision, PI, integrity-engine, finish-plan, privacy, open-source; rewrote foundations/execution/strategy; thinned product.md + offering/business-model stubs).
- Updated PRODUCT, SOUL, ROADMAP, DECISIONS, ARCHITECTURE, AGENTS; renamed growth architecture/roadmap files; Agency/Max drift fixed.
- New skill `fixflags-product-intelligence`; updated product/pipeline/marketing/completeness skills.
- Phase 1: `Project.productIntelligence`, ensure project on audit create, Contract carry + edit sync, Finish Plan UI, contract-aware ranking, MCP `ff_get_product_context` / `ff_get_current_finish_plan`, Remember on re-check + intentional dismissal.
- Quality: unit tests, agent-evals cases, MIN_SAMPLE_SIZE documented, typecheck/lint/unit/agent:eval green.

## Phase 2+ (documented, not built)

Repo→Finish Plan unify, CLI understand/finish/verify, portable export/OSS — gated on thesis signals in `knowledge/execution.md` / `ROADMAP.md` / `fixflags-cli/README.md`.

## Verify

- `npm run typecheck` / `lint` / `test:unit` / `agent:eval` — pass
- Apply migration `20260720170000_project_product_intelligence` on deploy (`npm run db:deploy`)
