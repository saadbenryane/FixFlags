# FixFlags CLI release

> Parked internal runbook.
> CLI publication and registry promotion are not part of the customer web release while FixFlags is URL-first.
> Use `npm run power-tools:verify` to maintain this implementation without promoting or advertising it.

The public package is `fixflags`. The website treats a release as installable
only after the exact version in `fixflags-cli/package.json` exists in the npm
registry.

## One-time package claim

npm requires a package to exist before its trusted publisher can be configured.
The operator must perform this one-time claim while authenticated to npm with
2FA. Do not put a password, OTP, automation token, or FixFlags API key in a
command, file, or shell history.

1. Rotate any FixFlags API key exposed during development.
2. Authenticate interactively with `npm login`.
3. Copy `fixflags-cli/` to a disposable directory outside the repository.
4. In that disposable copy, set the version to `0.0.0`, run the CLI tests and
   package-content check, and run `npm publish --tag bootstrap --access public`.
   Let npm prompt for the OTP.
5. In the npm package settings, configure the GitHub trusted publisher for this
   package with:
   - Organization or user: `saadbenryane`
   - Repository: `QewOS`
   - Workflow filename: `publish-cli.yml`
   - Environment: `npm`
   - Allowed action: `npm publish`
6. Protect the GitHub `npm` environment and `fixflags-cli-v*` release tags.
7. Delete the disposable copy.

The bootstrap version exists only to establish package ownership. Do not point
`beta` or `latest` at it.

## Version release

After the one-time claim and trusted-publisher setup:

1. Confirm `npm run agent -- verify --full` passes on the release commit.
2. Choose a new immutable semver version that does not exist in the registry, update both package files, and push the matching `fixflags-cli-v<version>` tag.
3. The workflow tests Node 22 on macOS, Linux, and Windows, checks package
   contents, clean-installs the tarball, publishes with OIDC trusted publishing,
   and verifies the exact version and Git SHA on the `candidate` dist-tag.
4. Run the dedicated power-tools verification outside `npm run verify:release`.
   Do not publish or promote a candidate while the CLI is parked.
5. Confirm `/api/cli/release` returns `"available": true` for the candidate.
6. Install from npm and run the FixFlags dogfood journey:

```bash
npm install --global fixflags@candidate
fixflags login
fixflags init https://fixflags.com
fixflags check https://fixflags.com --wait --plan
fixflags recheck <original-report-id> --wait --diff
```

Prereleases publish to `beta`; stable versions publish to `candidate`.
After the clean-install and production proofs pass for the exact candidate SHA, dispatch `promote-latest.yml` with version `1.0.5` and that full SHA.
The workflow verifies `candidate` again, moves only that immutable version to `latest`, and uploads `fixflags-1.0.5-promotion-receipt`.
Save the receipt with the signed release matrix.
Do not reuse a published version or move `latest` to an unverified build.
For a future CLI relaunch, call its separate release complete only after CLI and MCP report IDs, consolidated Flag identities, counts, ranking, Finish Plan, and update-review diffs match the web report and the promotion receipt exists.

The QewOS repository stays private. npm trusted publishing supports private
GitHub repositories, but npm provenance attestations require a public source
repository. The public npm package therefore uses short-lived OIDC credentials
without claiming provenance.

## Agent operations

Codex, Cursor, Claude, and other repository-aware agents must follow
`.cursor/skills/fixflags-npm-operations/SKILL.md`. `AGENTS.md` routes CLI work
to that skill. Run `npm run cli:status` for registry tags, publication time, and
download statistics without exposing credentials.
