# FixFlags plugin preparation

This is a development package for the existing remote MCP server at `https://fixflags.com/api/mcp`. It implements portable plugin packaging, listing metadata, the real brand assets, registry-derived tool descriptions and reviewer scenarios. It has not been submitted or published. Public MCP discovery remains disabled by `lib/mcp/discoverability.ts`.

Build from the repository root:

```sh
node scripts/growth/build-chatgpt-plugin.mjs
node scripts/growth/build-chatgpt-plugin.mjs --check
node scripts/growth/build-chatgpt-plugin.mjs --submission-ready
```

The first command writes a deterministic ZIP and readiness report beneath ignored `test-results/growth/chatgpt-plugin/`. `--check` validates without writing. `--submission-ready` refuses to emit an archive while live acceptance evidence is unproven. It has no approval flags or environment bypass. Clearing the existing discovery constant alone cannot make this package submission ready. Independently reviewed evidence needs a separately implemented provenance and acceptance integration before this command can authorize a submission archive.

The ZIP has root `plugin.json` and `mcp.json`, square brand images copied unchanged from `public/icon-512.png` and `public/brand/logo-mark-md.png`, this README, and generated `review/tool-contract.json`. The file list is explicit. Environment files, credentials, local accounts, build output and repository data cannot enter the archive through directory traversal or recursive collection.

## Authentication and live proof

The MCP config declares streamable HTTP, OAuth and dynamic client registration using the existing server's discovery. Its requested scopes match the current tool registry. There are no embedded tokens, headers, invented OAuth client IDs, new tools or endpoint overrides. Public OAuth discovery is currently hidden, so this package is not evidence of a working fresh install. Existing implementation references: `lib/mcp/oauth.ts`, `lib/mcp/tool-manifest.ts`, `lib/mcp/tools/sites.ts` and `lib/mcp/contract.ts`.

Before review, prove the full owned Site, Outcome, Flag, deployed fix and fresh comparable verification flow in real ChatGPT and Codex clients. Prove durable reconnect and same-run resumption, scope denial, revocation, cross-tenant denial, arbitrary-host denial, rate limiting, worker outage, blocked targets and incomparable evidence. Preserve current evidence requirements in `MCP_DISCOVERY_EVIDENCE`; no agent statement can replace them. Local tests and a valid ZIP establish neither this evidence nor publication eligibility.

## Reviewer preparation

The manifest supplies five positive cases, including an indirect request, and three negative cases. These are proposed scenarios, not executed results. Set up an authorized isolated reviewer account with sample owned Sites, Outcomes and recorded Flag evidence, then execute every case. Clarify selected IDs and actual change descriptions in the conversation rather than embedding real account data in this package. Record actual tools, results, scope, timestamps, run and attempt references, and uncertainties in private evidence outside the ZIP. Check that annotations in the generated tool contract match the live server's scan.

A valid public submission also requires a reviewer-accessible video recording, secure reviewer access through the dashboard, verified developer identity/domain, reachable support/privacy/terms pages and portal review. No recording, credentials, assigned app ID or approval is invented here. Enter credentials only through the secure portal form. Do not put reviewer instructions or credentials into manifest metadata. The package intentionally has no lifecycle hooks, registered-app mapping or bundled skill because the existing MCP contract supplies these workflows directly.

## Format provenance

Checked against official OpenAI documentation on 2026-10-20:

- [Package your plugin](https://developers.openai.com/plugins/build/plugins), portable root manifests and OpenAI extension fields.
- [Submit and publish](https://developers.openai.com/plugins/deploy/submission), current listing/review fields, five positive and three negative cases, DCR and credential boundaries.
- [MCP review requirements](https://developers.openai.com/plugins/deploy/app-review), live review obligations.
- [Optimize metadata](https://developers.openai.com/plugins/guides/optimize-metadata), explicit, indirect and negative prompt coverage.

The builder validates the supported field subset used here, declared file paths and limits, registry parity, image dimensions, secret exclusion and reproducible ZIP bytes. This is a local contract check, not the OpenAI portal validator or an assertion that the live server will pass review.
