---
name: fixflags-completeness
description: Reconcile FixFlags code, product contracts, UI, tests, skills, and canonical documentation before declaring work complete. Use for completeness passes, launch readiness, contract drift, or full verification.
---

# FixFlags completeness

Read `AGENTS.md`, `.agents/BOARD.md`, and `knowledge/README.md` first. Claim the write scope on `main`. Preserve every existing change.

## Workflow

1. Stabilize ownership. Snapshot Git state and wait for overlapping writers.
2. Run `npm run doctor` and `npm run completeness:audit` before editing. Treat failures as evidence, not exceptions to bypass.
3. Trace the user outcome through Flag → Fix → Re-check → Remember. Inspect route, service, persistence, UI, and entitlement boundaries together.
4. Fix the underlying contract. Consolidate shared decisions in services; keep routes as validation and response adapters.
5. Verify changed behavior with focused tests, actual runtime flows, responsive screenshots, and accessibility checks.
6. Run `npm run verify`, `npm run test:e2e`, the relevant packaging/Docker gates, and production smoke checks when credentials exist.
7. Reconcile canonical Markdown only after behavior passes. Record missing infrastructure or credentials as blockers.

## Required references

- Read [references/drift-rules.md](references/drift-rules.md) for manual review areas not fully enforceable by scripts.
- Read `knowledge/report-contract.md` when report structure or access changes.
- Read `docs/audit-pipeline.md` when capture, queue, judging, or finalize changes.

## Non-negotiable gates

- `npm run completeness:audit` owns counts, MCP/integration names, sticky destinations, Product/schema contracts, stale plan APIs, and tracked generated clutter.
- `npm run test:scripts` protects the completeness checker itself.
- Do not weaken quality evaluations to make a suite green. Find state pollution or adjudicate source evidence.
- Do not report Product Watch, protected sharing, CLI, or MCP contracts as shipped until their acceptance paths pass.
- Never retain plaintext compatibility, URL-prefix Product identity, silent catches, or half-functional startup behavior.
