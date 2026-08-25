# Power tools public-surface audit

Date: 2026-08-25

Scope: read-only audit of repository scanning, MCP, CLI, and adjacent public discovery surfaces.
The requested product boundary is one authenticated experience: submit a URL and receive a complete report.
Report UI files were not inspected for changes and were not modified.

## Recommendation

Park the power-user product as a complete public boundary, not only a navigation cleanup.
Remove its public pages and discovery artifacts, make its dedicated HTTP endpoints unavailable, and preserve the underlying services, persistence, and shared task contracts for later reactivation.
Do not introduce an off-by-default environment feature flag: the repository explicitly rejects unused `USE_*` gates.

The smallest coherent implementation has three layers:

1. Remove every customer-visible entry point and replace power-tool page routes with `notFound()` or remove the route modules so direct URLs fail closed.
2. Remove dedicated MCP, CLI-auth, GitHub-repository, and repo-scan HTTP route modules (or return an explicit unavailable response) so saved links, old clients, and existing API keys cannot bypass the UI cleanup.
3. Keep `lib/mcp/`, `lib/repo-scan/`, `lib/cli/`, the CLI package, Prisma models, queue handlers, task contracts, and entitlements dormant unless a later cleanup proves them unreferenced by the web review flow.

## 1. Customer-visible surfaces to hide

### Marketing and conversion

- Homepage renders `IntegrationsBlock` directly (`app/(marketing)/page.tsx:1,24`).
  The block advertises MCP and CLI and links to both public guides (`components/marketing/landing/IntegrationsBlock.tsx:50-57`; `lib/marketing/copy/homepage.ts:743-755`).
- The How it works hero and a full terminal/MCP section lead users into setup (`lib/marketing/copy/homepage.ts:161-171,290-311`; `app/(marketing)/how-it-works/page.tsx:165-193`).
- The marketing footer exposes an Integration guides link and a grid of editor-specific MCP guide links (`lib/site/nav.ts:19-24`; `components/layout/footer.tsx:49-82`).
- Pricing makes MCP a Pro differentiator and GitHub scans/Fix PRs Studio differentiators (`lib/billing/plans.ts:57-108`; `lib/marketing/copy/plans.ts:35-76`; `components/pricing/PricingComparisonTable.tsx:18-22`).
- FAQ, upgrade, onboarding, checkout, SEO, and auth copy repeatedly promise MCP (`lib/marketing/copy/faq.ts:56-76`; `lib/marketing/copy/plans.ts`; `lib/marketing/copy/auth.ts:128,331`; `components/dashboard/DashboardCheckoutToast.tsx:15-16`).
- Public sample copy says "repository-owned" and "repository demo" even though this is fixture provenance, not repo scanning (`lib/marketing/copy/homepage.ts:757-763`; `lib/marketing/static-sample.ts`).
  Replace only the customer wording with "curated demo" or equivalent; preserve fixture provenance internally.

### Authenticated app and direct pages

- Main sidebar exposes API Keys and Integrations (`components/layout/sidebar.tsx:44-49`).
- `/settings/integrations` is entirely the GitHub connection, allow-list, repo scan, scan history, and upgrade flow (`app/(app)/settings/integrations/page.tsx:51-383`).
- `/settings/api-keys` creates MCP credentials and links back to the public setup guide (`app/(app)/settings/api-keys/page.tsx:46-225`).
- Direct authenticated surfaces remain reachable without navigation:
  - `app/(app)/dashboard/mcp-setup/page.tsx`
  - `app/(app)/dashboard/mcp-analytics/page.tsx`
  - `app/(app)/cli/authorize/page.tsx`
  - `app/report/repo/[id]/page.tsx`
- Product workspace includes a direct GitHub-integration CTA (`components/product/ProductWorkspace.tsx:434-439`).
  Remove that CTA while leaving browser Signals alone unless the product simplification separately parks Watch/Signals.

### Docs, help, metadata, and machine discovery

- Docs navigation/catalog publicly lists integrations, CLI, MCP, and MCP tools (`lib/docs/catalog.ts:101-162`), with dedicated routes under `app/(docs)/docs/` and content in `content/docs/cli.md` and `content/docs/mcp.md`.
- Docs home, getting started, troubleshooting, generated search, and editor setup cross-link into MCP (`content/docs/index.md:7-26`; `content/docs/getting-started.md:19`; `content/docs/troubleshooting.md`; `lib/docs/content.ts:48-59`).
- Help has an MCP/editor category and articles for MCP, Lovable/Bolt connectors, and API keys (`lib/help/catalog.ts:24-26,363-423`), plus `/help/mcp` redirecting into integrations (`app/(marketing)/help/mcp/page.tsx`).
- Sitemap and `llms.txt` explicitly publish these routes (`lib/marketing/seo-routes.ts:23-31,54-77`; `app/sitemap.ts`).
- `llms.txt` advertises the MCP endpoint, API-key page, guide, and tool list (`lib/marketing/llms-txt.ts`).
- `/.well-known/mcp.json` is rewritten to a live discovery route (`next.config.ts:43-49`), and `public/.well-known/mcp-server.json` plus `public/.well-known/skills/fixflags/SKILL.md` expose machine-readable setup.
- SEO descriptions market MCP/CLI (`lib/marketing/copy/seo.ts:12-52`).

Remove these entries from navigation/search/index registries and return `noindex`/404 for old guide URLs.
Removing only sitemap entries is insufficient because the pages, footer links, `llms.txt`, and well-known files remain discoverable.

## 2. Dedicated public boundaries to make unavailable

These are separable from browser URL review and should fail closed while parked:

- MCP transport and discovery: `app/api/mcp/route.ts`, `app/api/well-known/mcp-json/route.ts`, and the `/.well-known/mcp.json` rewrite.
- CLI device/session/release routes: all route modules under `app/api/cli/`.
- GitHub repository OAuth and selection: all route modules under `app/api/integrations/github/`.
- Repository scans and Fix PRs: all route modules under `app/api/repo-scans/`.
- Credential issuance: `app/api/api-keys/route.ts` while no remaining public feature consumes general API keys.

Existing credentials matter.
The CLI calls `/api/mcp` (`fixflags-cli/src/mcp-bridge.ts:53-60`) and CLI login mints an `ApiKey` (`lib/cli/device-auth.ts:119-145`).
Hiding setup pages alone would therefore leave old CLI installs and existing keys operational.

Do not conflate repository OAuth with GitHub login.
Better Auth GitHub sign-in and `ConnectedAccounts` are authentication concerns and may remain; only `/api/integrations/github/*` and repository access should be parked.

## 3. Foundations safe to leave dormant

- `lib/mcp/`, including tool manifest, handlers, task adapters, and interaction types.
- `lib/repo-scan/`, repository worker stages, findings, and Fix PR logic.
- `lib/cli/` and `fixflags-cli/` source/tests, provided release/publish automation is removed from active launch gates and the npm package is not promoted.
- `ide-integrations/` and the well-known skill source may remain non-deployed/internal, but must not be copied into public build output.
- Prisma `ApiKey`, `McpInteraction`, `CliDeviceAuthorization`, `RepoScan`, repository connection fields, and related migrations.
- Shared audit/report application services and task contracts used by transports.
- Entitlement fields such as `canUseMcp` and `canScanRepositories` can remain dormant to avoid a risky schema/billing migration, but plan feature lists must stop promising them.

If the CLI is already published, code changes cannot make the registry artifact private.
Treat npm deprecation/unlisting and release-pipeline suspension as a separate operator action; do not unpublish automatically.

## 4. Risks to the URL-to-full-report flow

- Preserve `app/api/checks/route.ts`.
  It is the browser URL submission boundary and uses the authenticated web session (`app/api/checks/route.ts:48-61,107-157`), not CLI device auth or MCP API keys.
- Preserve `app/api/reports/[id]/*`, `app/report/[id]/*`, audit queue/capture/judge/finalize code, report access/claim, and `/post-login`.
- Preserve `components/audit/AuditInput.tsx` and the dashboard URL form (`app/(app)/dashboard/page.tsx:84-98`).
- Do not delete shared task/application services merely because MCP and CLI call them.
  Transport adapters should disappear; the review and update-review business boundary should remain.
- Do not remove GitHub as an authentication provider when removing repository access.
- Do not remove generic "copy this fix prompt into Lovable" language or builder-tuned prompts.
  The conversion wedge still needs copy/paste into Lovable; only connector, MCP, CLI, repository, and API-key setup claims should disappear.
- Decide separately whether Watch, Product Signals, share links, deep review, and compare are in scope.
  They are advanced features but are not repository/MCP/CLI foundations; broad deletion would exceed this request and increase risk to completed reports.

## Suggested execution order and proof

1. Add failing surface-contract tests asserting no navigation, pricing, homepage, docs/help search, sitemap, `llms.txt`, or metadata references to MCP, CLI, repository scans, API keys, or editor connectors.
2. Remove marketing/pricing/help/docs/app entry points and replace public fixture jargon.
3. Make the dedicated page and HTTP boundaries unavailable, including saved/direct URLs and existing credentials.
4. Remove public well-known artifacts and MCP rewrite; stop CLI promotion/release tasks without deleting the package foundation.
5. Run focused route, marketing, pricing, docs/help, sitemap/SEO, and authorization tests, then `npm run agent -- verify`.
6. Browser-prove signed-out homepage/pricing/docs/help and signed-in dashboard/settings at mobile and desktop widths.
7. Real-path proof: sign in, submit a URL from the dashboard, wait through the audit stages, and open the complete owned report.
8. Negative proof: old MCP, CLI auth, API-key, GitHub repo, repo-scan, and repo-report URLs are unavailable; an existing API key cannot invoke MCP.

Expected visible product after this pass: marketing leads to sign-up/sign-in; the signed-in dashboard shows Products plus `Review a URL`; settings contains account/security/billing concerns; submitting a URL still produces the complete owned report.
