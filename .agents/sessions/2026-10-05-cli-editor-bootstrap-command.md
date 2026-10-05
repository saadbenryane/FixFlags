# CLI editor bootstrap command

Date: 2026-10-05
Owner: codex-root
State: implemented and locally verified; unpublished and not an authenticated client-matrix pass

## Customer failure

The documented `npx fixflags init` path generated Codex, Claude Code, Cursor, and Windsurf MCP configuration with `command: fixflags`. An ephemeral `npx` invocation does not leave a global `fixflags` binary, so all generated clients could fail at their first process launch.

Setup also fetched the customer skill from `/.well-known/skills/fixflags/SKILL.md`. That route is intentionally unavailable while MCP discovery is withheld, creating a circular dependency: the private client matrix could not install until the public launch gate was opened.

## Repair

- Generated stdio configuration launches `npx --yes fixflags@<this package's exact version> mcp` (`npx.cmd` on Windows).
- The version is read from the installed package metadata and validated. Existing configs cannot silently float to a new dist-tag.
- No API key or stored credential is written to editor configuration. The spawned CLI continues to use the operating-system credential store.
- The canonical customer skill is synchronized from `public/.well-known/skills/fixflags/SKILL.md` into the package and validated for exact equality.
- `init` reads the bundled skill and no longer needs the intentionally hidden discovery URL.
- Package contents and operator documentation now encode the bootstrap contract.

## Evidence

- Red-before-green test first showed the generated command was `fixflags` rather than `npx`.
- All 16 CLI tests passed.
- Package contents passed with 17 files, including `SKILL.md` and no TypeScript source or dependencies.
- A clean tarball install passed and reported version 1.0.5.
- `npx --yes fixflags@1.0.4 --version` proved the exact-version runner works against the currently published package.
- Generated 1.0.5 configs were parsed by the installed clients:
  - Codex CLI 0.155.1 listed `fixflags`, `npx`, and `--yes fixflags@1.0.5 mcp` from an isolated user config.
  - Claude Code 2.1.278 recognized the same server and correctly left it pending approval.
  - Cursor 3.23.12 recognized the workspace server and correctly reported that approval was needed.
- The disposable client-config directory was moved to Trash after inspection and is recoverable there.

## Registry and release boundary

Registry truth on 2026-10-05: `latest` is 1.0.4, `beta` is 1.0.0, and repository version 1.0.5 is not published. No candidate dist-tag exists. No package was published, tagged, promoted, or added to a real user profile.

This does not pass the Codex/Claude Code/Cursor launch matrix. Version 1.0.5 must first follow the existing candidate release process, then each client must authenticate against the candidate deployment and complete the Site → Outcome → Run → Flag → Fix → Verify → recurrence loop. Public MCP discovery remains closed.
