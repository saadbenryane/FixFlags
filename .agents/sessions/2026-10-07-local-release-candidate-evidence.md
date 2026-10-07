# Local release candidate evidence

**Task:** `local-release-candidate-evidence-2026-10-07`  
**Candidate:** `c48ecd59e1c5a370cccfdae000635d22a1776101`  
**Status:** locally verified runtime candidate; not deployed or customer validated

## Full manifest

The clean candidate passed the full 29-command repository manifest. It covered
database validation and drift, TypeScript, lint, product and route contracts,
skill/copy/knowledge/completeness/security guards, script and unit tests,
coverage, accuracy evaluation, the optimized Next build, and the worker bundle.

Receipt: `.agent-runs/2026-10-06T23-19-25-140Z-worker-build.log`.

## Production image

`docker build -t fixflags:verify .` succeeded for the same candidate. The build:

- generated Prisma Client;
- compiled the optimized web application and all 127 static pages;
- built the worker bundle;
- pruned to 540 production packages; and
- reported zero dependency vulnerabilities after pruning.

Local image identity:
`sha256:6d3928222fa0d1d66da98afd05ca42dc1a1c301644ad2ab4d8cdb638c5ce3f47`.

A direct runtime probe confirmed one image contains `server.js`, the worker
bundle, Prisma migrations and CLI, and the runtime launcher. Production MCP
core/server and Prisma Client resolve. The test-only MCP client and removed
`tsc-alias` do not resolve.

## Rendered image behavior

The built image was started with inert localhost database/Redis endpoints and
placeholder launch configuration solely to exercise public, read-only Docs; no
real service or credential was used. `/docs` returned 200 and rendered Getting
started, Site care, and Troubleshooting. It contained no MCP guide link.
`/docs/mcp` returned 404. The temporary container was stopped afterward.

Early probe attempts intentionally failed closed while required production
variables were absent or mismatched. Once the complete inert configuration was
present, the image served the expected routes. This validates the environment
guard as well as the content packaging.

## Boundary

While the image proof was running, another clean commit
`acd5eac14561a8096d235d83e3aa4b1dfd2e06c5` added shared-footer brand parity.
That change is preserved but is not covered by this exact candidate image.

This evidence does not replace the blocked release-environment foundation,
exact production SHA attestation, credentialed Codex/Claude Code/Cursor matrix,
14-day/100-run Watch reliability and COGS window, or paid-opening gates.

