# Docs and editor integration system

## Task

- **ID:** docs-editor-integration-system
- **Agent:** codex-root
- **Date:** 2026-07-29

## Outcome

FixFlags now has a public documentation product under `/docs` with typed navigation, Markdown narrative pages, local search, responsive mobile navigation, right-side page contents, accessible copyable code, metadata, structured data, sitemap coverage, loading/error/not-found states, and a manifest-backed MCP tool reference.

One editor catalog defines Lovable, Bolt, Cursor, Replit, Claude Code, Windsurf, Codex, and Devin across the homepage, footer, docs, preferences, authenticated setup, API-key attribution, and completeness guards. Public examples use placeholders. The authenticated wizard creates an editor-tagged credential, reveals it once, renders the platform-specific setup, tests complete tool discovery, and returns to the originating guide.

The homepage integration section is a clean two-row grid on desktop and tablet and a two-column grid on mobile. It has no right-side mock UI or card outlines. Every mark links to its stable guide anchor.

`/help` remains the customer-support surface. `/help/mcp` permanently redirects to `/docs/integrations`. The CLI configures only Cursor, Claude Code, Windsurf, and Codex; hosted connector pseudo-files were removed.

## Files touched

- `app/(docs)/`, `components/docs/`, `content/docs/`, `lib/docs/`
- `lib/integrations/`, `components/marketing/landing/`, `components/layout/footer.tsx`
- `app/(app)/dashboard/mcp-setup/page.tsx`, `app/api/me/preferences/`
- `fixflags-cli/src/init.ts`, `fixflags-cli/test/auth-init.test.mjs`
- `lib/mcp/`, `prisma/schema.prisma`, `prisma/migrations/20260729164000_add_editor_api_key_clients/`
- `lib/marketing/`, `lib/help/`, `scripts/completeness-audit.mjs`
- `PRODUCT.md`, `CODEMAP.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`

## Verification

- Local service doctor passed.
- Prisma migration applied locally; migration status is current.
- TypeScript passed.
- Focused docs, editor catalog, preferences, homepage, and MCP manifest tests passed: 41 tests.
- CLI suite passed: 12 tests, including dry-run, idempotence, all supported editors, malformed-config protection, authentication, and Check/Re-check workflows.
- SEO guard passed.
- Completeness audit passed with 52 models, 18 MCP tools, 8 editor integrations, and 8 report destinations.
- Browser inspected homepage and docs at 375px, 768px, and 1280px. Editor anchors, search, mobile navigation, two-column/four-column editor grids, code wrapping, and horizontal overflow checks passed.

## Follow-ups

The local architecture and product surfaces are complete. Production-smoke evidence still requires credentials for each vendor platform plus the deployed npm release. Do not expand `PRODUCT.md` from the currently verified integration claim until real tool discovery, `ff_check_and_plan`, deployment, and `ff_recheck_and_compare` are recorded for the newly cataloged platforms.
