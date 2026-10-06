# Runtime and toolchain dependency advisory repair

**Task:** `runtime-dependency-advisories-2026-10-06`
**Status:** locally verified; not deployed

## Detection

The permanent security gate caught newly published denial-of-service advisories after the rest of the full manifest had passed:

- `source-map-js@1.2.1`, `GHSA-68fv-2mgg-jv7q`, high severity, present through production `postcss`.
- `fast-copy@4.0.4`, `GHSA-jggr-w7fw-pc2j`, moderate severity, build tooling through `pino-pretty`.
- `postcss-selector-parser@6.1.4`, `GHSA-rj75-hqrm-r3gf`, moderate severity, build tooling through Tailwind/PostCSS.

All three had published patched releases. No audit suppression was added and `npm audit fix --force` was not used.

## Repair

Exact overrides and the lockfile now resolve:

- `source-map-js@1.2.2`
- `fast-copy@4.1.2`
- `postcss-selector-parser@7.1.6`

The existing reviewed build-only `braces` advisory remains the only accepted exception chain. Runtime audit reports no moderate-or-higher vulnerability.

## Evidence

- `npm ls source-map-js fast-copy postcss-selector-parser postcss-nested tailwindcss tailwindcss-animate --all` showed every affected path deduplicated to the patched versions.
- `npm run security:audit` passed with a clean runtime graph and only the reviewed build-only chain.
- The final full 30-command manifest passed after the ledger updates, including clean dependency inspection, TypeScript, lint, tests, coverage, accuracy, optimized Next build, worker bundle, and production container: `.agent-runs/2026-10-06T14-52-53-492Z-container-build.log`.

No push, deployment, public MCP opening, or paid-access change occurred.
