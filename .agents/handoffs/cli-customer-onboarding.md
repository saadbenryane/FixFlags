# CLI customer onboarding handoff

## Status

Implementation is complete locally. Public npm installation and production
dogfood are blocked on the operator-only initial npm claim, trusted-publisher
configuration, protected tag push, and rotation of the API key exposed in the
conversation.

## Implemented

- Browser device authorization with ten-minute expiry, bounded polling, denial,
  one-time encrypted credential delivery, cleanup, and revocation of uncollected
  credentials.
- `fixflags login`, `login --with-token`, `whoami`, and `logout`, with
  `FIXFLAGS_API_KEY` precedence and operating-system credential storage.
- No command-argument token path and no silent plaintext fallback. Explicit
  `--insecure-storage` remains available for systems without a credential store.
- `fixflags init` for Codex, Claude, Cursor, Lovable, and Bolt with dry-run,
  editor, scope, and automation options.
- A local `fixflags mcp` bridge lets Codex, Claude, and Cursor use the CLI
  credential store without writing secrets into project MCP configuration.
- Canonical public customer skill at
  `/.well-known/skills/fixflags/SKILL.md`, website download/copy controls, and
  separate repository validation.
- Registry-backed website availability, protected cross-platform npm release
  workflow, provenance, package-content checks, and clean-install smoke.
- Unified Connect FixFlags setup and MCP-only alternative.

## Verified

- CLI tests: 12 passing, including browser login, manual stdin token login,
  identity, revocation, idempotent init, and MCP bridge.
- CLI package-content and clean-install checks pass on Node 22.
- CLI/API focused tests: 19 passing.
- TypeScript, lint, route contract, skill validation, product contract, worker
  build, web production build, dependency audit, and accuracy evaluation pass.
- Live local device request returns 201 and pending token polling returns 428.
- Browser verification confirms npm-unavailable honesty, skill download, and
  sign-in return-path preservation for `/cli/authorize`.

## External and shared-tree blockers

- `fixflags@0.2.0-beta.1` is not yet on npm. Follow `docs/cli-release.md`.
- The full repository gate is currently blocked by concurrent pricing/Studio
  work outside this task: `Plan.STUDIO` has no migration, fifteen pricing/copy
  tests are stale, and the MCP expected tool count remains 17 while 18 tools are
  registered. Those files were preserved.
- Production check → fix → deploy → Re-check cannot run through the published
  package until the npm release exists and the exposed API key is rotated.
