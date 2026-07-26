# FixFlags CLI release

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

## Beta release

After the one-time claim and trusted-publisher setup:

1. Confirm `npm run agent -- verify --full` passes on the release commit.
2. Push the version tag matching the package version:
   `fixflags-cli-v0.2.0-beta.1`.
3. The workflow tests Node 22 on macOS, Linux, and Windows, checks package
   contents, clean-installs the tarball, publishes with OIDC trusted publishing,
   and
   verifies the exact version in the registry.
4. Confirm `/api/cli/release` returns `"available": true`.
5. Install from npm and run the FixFlags dogfood journey:

```bash
npm install --global fixflags@beta
fixflags login
fixflags init https://fixflags.com
fixflags check https://fixflags.com --wait --plan
fixflags recheck <original-report-id> --wait --diff
```

Promote `beta` to `latest` only after CLI and MCP report IDs, consolidated Flag
identities, counts, ranking, and Re-check diffs match the web report.

The QewOS repository stays private. npm trusted publishing supports private
GitHub repositories, but npm provenance attestations require a public source
repository. The public npm package therefore uses short-lived OIDC credentials
without claiming provenance.
