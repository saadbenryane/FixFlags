# Independent-monitor alignment receipt

**Scope:** documentation and architecture planning only. No application behavior, schema, route, deployment, or public copy implementation changed.

## Baseline inspected

- Repository baseline: `e73552c8996639c4e4177a0935502f220de2b8e6`.
- Prisma ownership and lifecycle: Project, provisional Site, SiteOutcome/Page, Audit, JourneyReview, Flag, Improvement/occurrence/attempt/verifier, Watch, Shopify, Site Agent/support, API keys/device auth, MCP interaction ledger.
- Application/execution: `lib/sites/application`, Audit creation/monitoring/Watch, browser Journey runner, deterministic checks and category coverage, Railway deployment webhook, Shopify/integrity, ProductSignal.
- MCP/CLI: Streamable HTTP route, tool manifest and report-shaped tools, authorization, structured results, stdio bridge, installer/editor catalog, parked edge routes.
- Customer/public surfaces: route inventory, Site routes/APIs, dashboard/auth/billing/docs/help/report compatibility, live homepage, pricing, docs, MCP docs path, and public sample.
- Canonical direction: vision, architecture, masterplan, roadmap, PRD, voice, workspace/card contracts, migration, evidence/security, current implementation and repository routing.
- Current MCP protocol research: 2026-07-28 authorization, tools/structured outputs, Streamable HTTP, and optional Tasks extension.

## Decisions recorded

- Keep the existing Site/Project as launch root.
- Adapt `SiteOutcome`; do not promote its current descriptive shape unchanged and do not create a parallel Monitor/Task/Objective hierarchy.
- Outcome is the important-result health unit; Journey is one human browser execution method.
- Preserve broad category/signal health separately from Outcome health.
- Keep Audit as the physical run ledger and out of primary customer language.
- Route UI, Watch, MCP, deployment, API, Shopify/integration, and internal triggers through one tenant-scoped RunRequest/application command.
- MCP is launch-critical and must prove change → verify → Flag → fix → verify → Clear using the same engine as Watch.
- Reuse MCP transport/auth/CLI/editor/ledger infrastructure; retire report-shaped tool discovery after compatibility.
- Generalized autonomous-agent evaluation is post-launch; deterministic HTTP/API verification is the first machine-facing extension.

## Canon updated

- `knowledge/vision.md`
- `docs/product-architecture.md`
- `docs/product-masterplan.md`
- `ROADMAP.md`
- `docs/product-prd.md`
- `docs/voice-and-copy.md`
- supporting canonical indexes, repository routing, current-product boundary, UI/card/migration contracts and task board

## Verification

- `npm run doctor` passed before documentation changes.
- `npm run agent:heartbeat -- --json` returned `ok: true`; stale codex-root release tasks were marked superseded by the new launch gate.
- `npm run knowledge:duplication-guard` passed.
- `npm run completeness:audit` passed: 83 models, 2 rendered report sections, parked power tools verified separately.
- Changed canonical Markdown links resolve locally.
- Prettier check/write completed for changed Markdown files.
- `git diff --check` passed.
- `npm run agent -- verify --dry-run` correctly selected no runtime checks for documentation-only changes.

## Remaining work

Everything in the masterplan launch gates is TARGET, not implemented by this session. Current public behavior remains the Site baseline described in `PRODUCT.md`; MCP remains parked until its Site/Outcome authorization and end-to-end loop are implemented and client-proven.
