---
name: fixflags-npm-operations
description: Operate the public FixFlags npm CLI from the private QewOS repository. Use for npm package status or download statistics, CLI README and package metadata updates, beta or stable releases, trusted-publisher failures, installation checks, dist-tag questions, or FixFlags CLI release incidents.
---

# FixFlags npm operations

Keep QewOS private while maintaining the public `fixflags` package. Read
`AGENTS.md`, `.agents/BOARD.md`, `docs/cli-release.md`,
`fixflags-cli/package.json`, `fixflags-cli/README.md`, and
`.github/workflows/publish-cli.yml` before changing release behavior.

## Inspect

1. Run `npm run agent -- context cli`.
2. Run `npm run cli:status` for registry tags, publication time, and npm
   download totals. Use `npm run cli:status -- --json` for structured output.
3. Run `gh run list --workflow publish-cli.yml` for release history.
4. Run `npm view fixflags@beta --json` when exact registry metadata matters.
5. Treat the npm registry and completed GitHub workflow as truth. Do not infer a
   release from the repository version alone.

Never print npm credentials, FixFlags API keys, authorization device codes, or
the complete environment.

## Update

- Edit customer CLI documentation in `fixflags-cli/README.md`.
- Edit operator procedure in `docs/cli-release.md`.
- Edit package metadata in `fixflags-cli/package.json`; keep
  `fixflags-cli/package-lock.json` synchronized.
- Route visible website copy through `lib/marketing/copy.ts`.
- Keep the package allowlist limited to `bin`, compiled `dist`, README,
  LICENSE, and package metadata. Confirm with
  `npm --prefix fixflags-cli run package:check`.
- Do not duplicate versions, commands, or release requirements in a new
  Markdown file. Link to the canonical files.

## Release

1. Choose a new semver version. Never reuse or move a tag for a version that
   reached npm.
2. Update both CLI package files and any exact version guard.
3. Run:
   - `npm --prefix fixflags-cli test`
   - `npm --prefix fixflags-cli run package:check`
   - `node scripts/verify-cli-package.mjs`
   - `npm run agent -- verify --dry-run`
   - the selected repository verification
4. Inspect the packed file list. Stop if it contains source, credentials,
   repository-only files, or unexpected artifacts.
5. Commit and push the verified release state.
6. Tag that exact commit as `fixflags-cli-v<version>` and push the tag.
7. Monitor `publish-cli.yml` through completion. The workflow must pass on
   Node 22 for macOS, Linux, and Windows before OIDC publishing runs.
8. Verify the exact version from npm, clean-install it, and run
   `fixflags --version`.
9. For beta releases, verify `fixflags@beta`. Publish a new stable semver
   version to change `latest`; do not point `latest` at an unverified beta.
10. Exercise login, init, check, and Re-check against production before calling
    the release complete.

If a tag-triggered workflow fails before npm publication, fix the cause and
create a clean release attempt. If npm already contains the version, bump the
version. npm versions are immutable.

## Security and repository privacy

- QewOS remains private. The npm package remains public.
- Trusted publishing is bound to `saadbenryane/QewOS`,
  `.github/workflows/publish-cli.yml`, the `npm` environment, and the
  `npm publish` permission.
- Use short-lived GitHub OIDC publishing. Do not create a long-lived npm token.
- npm provenance attestations are unavailable while the source repository is
  private. Do not add `--provenance` or claim provenance.
- Keep interactive credentials in the operating-system credential store.
- Never put credentials in arguments, generated editor files, analytics,
  Markdown, commits, or logs.
- Do not make QewOS public to gain provenance. A separately reviewed public
  CLI-only repository is the only acceptable future provenance path.

## Recovery

- Diagnose failed workflows from the failed job logs before editing.
- Revoke leaked credentials immediately; never reuse the exposed value.
- Deprecating a version, changing package access, deleting a dist-tag, or
  transferring ownership is destructive. Resolve the exact target and obtain
  explicit user approval.
- Keep the bootstrap `0.0.0` version for ownership history. It is not a usable
  release and must not become the documented installation target.
