---
name: fixflags-completeness
description: Reconcile FixFlags code, product contracts, UI, tests, skills, and canonical documentation before declaring work complete. Use for completeness passes, launch readiness, contract drift, or full verification.
---

# FixFlags completeness

Read `AGENTS.md`, `.agents/BOARD.md`, and `knowledge/README.md` first. Claim the write scope on `main`. Preserve every existing change.

## Workflow

1. Stabilize ownership. Snapshot Git state and wait for overlapping writers.
2. Run `npm run doctor`, `npm run completeness:audit`, and `npm run agent -- verify --dry-run` before editing. Treat failures as evidence, not exceptions to bypass.
3. Trace the user outcome through Flag → Fix → Re-check → Remember. Inspect route, service, persistence, UI, and entitlement boundaries together.
4. Fix the underlying contract. Consolidate shared decisions in services; keep routes as validation and response adapters.
5. Verify changed behavior with focused tests, actual runtime flows, responsive screenshots, and accessibility checks.
6. Run `npm run verify` for the full local gate and `npm run verify:release` for clean install, browser, container, and deployed readiness probes. Missing release credentials are blockers, never skips.
7. Reconcile canonical Markdown only after behavior passes. Record missing infrastructure or credentials as blockers.

## Exit criteria (product completion)

- `npm run verify` green on `main`
- `npm run verify:release` executed with designated credentials (not skipped)
- [`.agents/sessions/credentialed-journey-matrix.md`](../../../.agents/sessions/credentialed-journey-matrix.md) signed off for revenue-critical journeys
- Manual report contract smoke (anonymous + signed-in) per QUALITY §86–96
- Browser capture truth: slow replay wired in `run-page.ts`; capability matrix matches production wiring
- AXI applies to CLI/MCP agent tooling only — not Playwright audit capture (see `fixflags-browser-capture` skill)

## Required references

- Read [references/drift-rules.md](references/drift-rules.md) for manual review areas not fully enforceable by scripts.
- Read `knowledge/report-contract.md` when report structure or access changes.
- Read `docs/audit-pipeline.md` when capture, queue, judging, or finalize changes.

## Non-negotiable gates

- `npm run completeness:audit` owns counts, MCP/integration names, sticky destinations, Product/schema contracts, stale plan APIs, and tracked generated clutter.
- `npm run accuracy:eval` owns offline scan accuracy: gold-standard false blockers, builder top-3, demo v1 repair, non-HTML regression.
- `npm run routes:contract-guard` generates the endpoint inventory and applicable acceptance cases from code.
- Finish Plan ranking must use `buildUnifiedFinishPlan` on every surface (report, MCP, export, task contracts).
- Preview scan access is Agency-gated at the API and threaded through capture, journey, flow, and visual evidence paths.
- CI deploy hooks: Railway project webhook at `/api/webhooks/railway` with `apiKey`, `url`, and optional `webhookSecret`.
- `npm run skills:validate` protects skill frontmatter, links, reference depth, stale terms, length, and volatile facts.
- `npm run test:scripts` protects the completeness checker itself.
- Do not weaken quality evaluations to make a suite green. Find state pollution or adjudicate source evidence.
- Do not report Product Watch, protected sharing, CLI, or MCP contracts as shipped until their acceptance paths pass.
- Never retain plaintext compatibility, URL-prefix Product identity, silent catches, or half-functional startup behavior.
