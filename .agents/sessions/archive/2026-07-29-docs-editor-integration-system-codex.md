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

## Completeness re-audit

The public routes, responsive shell, homepage grid, editor catalog, authenticated setup path,
Help separation, CLI editor cleanup, migration, SEO registration, and core browser behavior are
implemented. A subsequent contract-level review found three local completion areas that should
not be hidden behind the passing count audit:

1. The MCP tool page is generated from canonical names and descriptions, but it does not yet
   render the live input schemas. The Zod input shapes still live beside the registered handlers.
2. The website uses the editor catalog and configuration generator, while the standalone CLI
   retains its own editor list and setup branches. Their different transports are intentional,
   but editor identity, paths, capabilities, and strategy selection still need one
   runtime-neutral contract with a generated CLI artifact.
3. Catalog and homepage tests exist, but the docs search keyboard behavior, Markdown link
   handling, setup entitlement states, connection timeout/missing-tool states, redirects,
   structured data, sitemap, `llms.txt`, and rendered broken-link checks do not yet have the
   complete automated matrix described in the original plan.

## Completion plan

### P0. Canonical contracts

- Move every public MCP input shape into a manifest-adjacent schema registry.
- Make each MCP registration consume that schema instead of declaring a second inline shape.
- Generate `/docs/mcp/tools` parameter tables from the same schema, including required state,
  type, enum values, defaults, and descriptions.
- Extend the MCP quality gate so every manifest tool has exactly one registered handler and one
  public input schema.
- Introduce a runtime-neutral editor setup contract for identity, capability, configuration
  location, and strategy.
- Generate the CLI's distributable editor contract from that source. Keep direct remote MCP for
  the web wizard and the authenticated local bridge for the CLI as explicit strategies.
- Remove the CLI's independent supported-editor array after the generated contract is enforced
  by a stale-artifact check.

### P1. Integration guidance and setup behavior

- Add typed, platform-specific setup steps, verification instructions, success criteria, and
  troubleshooting to every editor definition.
- Render real hosted-connector instructions for Lovable, Bolt, Replit, and Devin and local file
  instructions for Cursor, Claude Code, Windsurf, and Codex.
- Keep prompt specialization separate from connection capability.
- Extract the setup wizard's transition rules into a testable state model while keeping key
  creation and entitlement checks at their existing server boundaries.
- Cover signed-out return preservation, Free-plan upgrade, paid key creation, one-time reveal,
  malformed config, timeout, partial tool discovery, success, and return-to-guide behavior.

### P1. Documentation quality

- Add keyboard result navigation and active-descendant semantics to docs search.
- Test empty search, Markdown internal and external links, generated heading IDs, code-copy
  success and failure, mobile drawer behavior, and malformed-content recovery.
- Add a rendered docs link-and-anchor crawler covering all narrative Markdown, editor anchors,
  Help links, official vendor links, and generated MCP tool anchors.
- Add direct tests for permanent redirects, canonical metadata, Breadcrumb and TechArticle JSON-LD,
  sitemap entries, and `llms.txt`.

### P2. Acceptance and release proof

- Re-run browser acceptance at 375, 768, and 1280 pixels with keyboard-only navigation, visible
  focus, 200% zoom, reduced motion, dark mode, contrast, screen-reader names, and no overflow.
- Exercise the signed-in wizard and verify it returns to the selected editor heading.
- Run `npm run verify` on a stable working tree, then the credentialed release gate.
- Connect all eight real vendor clients, confirm the complete public tool list, run
  `ff_check_and_plan`, apply and deploy one real fix, and run `ff_recheck_and_compare`.
- Record each result in the credentialed journey matrix. Change `productionSmoke` to `verified`
  only from recorded evidence.
- Keep the shipped integration claim at its currently verified count until those smokes pass.
- Publish and advertise the CLI install command only after the exact npm version is available and
  the release endpoint verifies it.

## Exit criteria

- The MCP server, public tool reference, and completeness gate consume one schema contract.
- Homepage, footer, docs, setup, preferences, analytics, and CLI consume one editor contract or
  its verified generated artifact.
- Every requested docs/setup/search/redirect/SEO state has automated coverage.
- Local doctor, completeness, accuracy, CLI packaging, web build, worker build, and full
  repository verification pass on a stable tree.
- Eight-editor production claims remain blocked until the credentialed vendor journey matrix and
  exact CLI release proof are complete.
