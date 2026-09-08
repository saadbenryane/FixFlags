---
name: fixflags-completeness
description: Reconcile FixFlags code, product contracts, UI, tests, skills, and canonical documentation before declaring work complete. Use for completeness passes, launch readiness, contract drift, or full verification.
---

# FixFlags completeness

Read `AGENTS.md`, `.agents/BOARD.md`, and `knowledge/README.md` first. Claim the write scope on `main`. Preserve every existing change.

## Workflow

1. Stabilize ownership. Snapshot Git state and wait for overlapping writers.
2. Run `npm run doctor`, `npm run completeness:audit`, and `npm run agent -- verify --dry-run` before editing. Treat failures as evidence, not exceptions to bypass.
3. For the new version, trace the PRD journey through Site → Flag → Fix → Verify → Keep watching. For legacy routes, trace their existing compatibility contract. Inspect route, service, persistence, UI, and entitlement boundaries together.
4. Fix the underlying contract. Consolidate shared decisions in services; keep routes as validation and response adapters.
5. Verify changed behavior with focused tests, actual runtime flows, responsive screenshots, and accessibility checks.
6. For full product/release completion, run `npm run verify` and the applicable `npm run verify:release` credentialed gates. For documentation-only vision/plan work, use source-fidelity, local-link, skills and drift checks as the explicitly scoped equivalent; do not claim product or release completion.
7. Reconcile canonical Markdown with the correct VISION/NEXT/SHIPPED status. Documentation may intentionally specify the next version before implementation. Missing required release evidence blocks a release claim, not recording the plan.

## Exit criteria (full product/release completion)

For the new version, add the Site acceptance scenarios in docs/product-prd.md. Report-specific items below apply to legacy compatibility only while those routes remain.

- `npm run verify` green on `main`
- `npm run verify:release` executed with designated credentials (not skipped)
- `.agents/sessions/credentialed-journey-matrix.md` signed off for revenue-critical journeys
- Manual report contract smoke (anonymous + signed-in) per QUALITY.md report contract section
- Production first-value dogfood per customer-journey-completion-plan.md: Phase 0 brand done; anonymous evidence and deterministic Agent updates visible; fix prompt **bodies** absent until authentication; gated Copy chrome is visible and must not write the clipboard; no placeholder clipboard
- Browser capture truth: slow replay wired in `run-page.ts`; capability matrix matches production wiring
- AXI applies to CLI/MCP agent tooling only — not Playwright audit capture (see fixflags-browser-capture skill)

## Required references

- Read `references/drift-rules.md` for manual review areas not fully enforceable by scripts.
- Read `knowledge/report-contract.md` when report structure or access changes.
- Read `docs/audit-pipeline.md` when capture, queue, judging, or finalize changes.

## Non-negotiable gates

Legacy report/Finish Plan/preview rules below preserve existing behavior; they do not dictate the new Site interface or future plan responsibilities.

- `npm run completeness:audit` owns counts, MCP/integration names, sticky destinations, Product/schema contracts, stale plan APIs, and tracked generated clutter.
- `npm run accuracy:eval` owns offline scan accuracy: gold-standard false blockers, builder top-3, demo v1 repair, non-HTML regression.
- `npm run routes:contract-guard` generates the endpoint inventory and applicable acceptance cases from code.
- Fix List and Finish Plan ranking must use `buildUnifiedPlanBundle` / `buildFixArtifacts` on every surface (report, MCP, export, task contracts).
- Preview scan access is Studio-gated at the API and threaded through capture, journey, flow, and visual evidence paths.
- CI deploy hooks: Railway project webhook at `/api/webhooks/railway` with `apiKey`, `url`, and optional `webhookSecret`.
- `npm run skills:validate` protects skill frontmatter, links, reference depth, stale terms, length, and volatile facts.
- `npm run test:scripts` protects the completeness checker itself.
- Do not weaken quality evaluations to make a suite green. Find state pollution or adjudicate source evidence.
- Do not report Product Watch, protected sharing, CLI, or MCP contracts as shipped until their acceptance paths pass.
- Never retain plaintext compatibility, URL-prefix Product identity, silent catches, or half-functional startup behavior.
- Do not mark Touch or launch complete while anonymous evidence is locked, Agent progress is fabricated, gated prompts leak, or Copy controls can copy placeholder text.
