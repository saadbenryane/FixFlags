# URL-first public product scope

## Outcome

FixFlags now presents the URL-to-Product-Review path as the only public and signed-in customer experience.
Repository scanning, MCP, API-key setup, and CLI surfaces are parked without deleting their underlying libraries, persistence, worker support, or packaged source.

## Public boundary

The application proxy returns 404 for dedicated repository, MCP, API-key, CLI authorization, setup, analytics, documentation, help, discovery, and API paths.
The boundary explicitly leaves `/`, `/dashboard`, `/settings`, `/api/checks`, `/api/reports/[id]/*`, and `/report/[id]` available.
GitHub account authentication remains available and is separate from parked GitHub repository access.

Homepage integration promotion, the How it works MCP section, footer editor-connection links, sidebar API-key and integration links, the report MCP action, and the Product GitHub integration action were removed.
Pricing, FAQ, authentication, help, docs, SEO, sitemap, and `llms.txt` copy now describe Product Reviews, evidence-backed copy/paste fixes, update reviews, compare, and sharing without offering the parked tools.

Public documentation now contains Product Review, report, deep review, and URL/report troubleshooting material only.
The previous MCP and CLI content remains in dormant source files and is not cataloged, indexed, or routable.

## Preserved foundations

No domain implementation was removed from `lib/mcp/`, `lib/repo-scan/`, `lib/cli/`, `fixflags-cli/`, Prisma models, queues, or shared task services.
No report hierarchy, report data contract, audit pipeline, authentication return path, billing enforcement, or URL submission endpoint was changed.

## Proof

- `npx tsc --noEmit --incremental false` passed.
- `npm run lint` passed.
- Focused public-scope, docs, help, nav, pricing, and report-action tests passed: 41 tests.
- `npx vitest run lib/marketing/` passed: 62 tests.
- `npm run seo:guard` and `npm run completeness:audit` passed.
- Brand, UI drift, and image guards passed.
- A real local Next.js runtime returned 404 for `/docs/mcp`, `/docs/cli`, `/settings/api-keys`, `/dashboard/mcp-setup`, `/report/repo/test`, `/api/mcp`, `/api/cli/auth/device`, `/api/repo-scans`, and `/api/well-known/mcp-json`.
- The same runtime returned 200 for `/` and `/docs`, while `/api/checks` returned its expected method boundary instead of the parked 404.

## Broader gate note

`npm run agent -- verify` passed typecheck, lint, and the app suite before stopping in the component suite on four concurrent report-owned expectation failures.
The failures are stale labels in `AuditInput.test.tsx`, `ImprovementReceipt.test.tsx`, and `ProductReviewAction.test.tsx`; none of those implementation paths were changed by this task.
They were left for the agent already working on report behavior to avoid overlapping ownership.

## Research evidence

The read-only surface inventory is recorded in `2026-08-25-power-tools-surface-audit.md`.
