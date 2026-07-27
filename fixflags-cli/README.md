# FixFlags CLI

Product Intelligence for AI-built products. A thin, task-shaped client over the FixFlags MCP API.

## Status

Version `0.2.0-beta.1` is release-ready. The website only presents it as
installable after that exact version is verified on npm. Publishing is performed
from a version tag through npm trusted publishing. The QewOS source
repository stays private, so npm provenance attestations are intentionally not
generated.

## Setup

```bash
npm install --global fixflags@beta
fixflags login
fixflags init https://your-app.com
```

Browser login stores the credential in the operating-system credential store.
Use `fixflags login --with-token` to paste a manually created key through a
hidden prompt or standard input. Plaintext storage is never selected silently.
For CI, set `FIXFLAGS_API_KEY`; it has the highest precedence. Set
`FIXFLAGS_API_URL` only when targeting a non-production API.

`fixflags init` merges FixFlags-managed editor configuration without replacing
existing settings. Codex, Claude, and Cursor run `fixflags mcp` as a local
bridge, so the editor uses the same credential store without putting a secret in
the repository. Use `--dry-run`, `--editor`, `--scope`, and `--yes` for review
or automation.

## Usage

```bash
# Check a URL and return every ranked fix
fixflags check https://your-app.com --wait --plan

# Print complete fix prompts instead of bounded previews
fixflags check https://your-app.com --full

# Queue without waiting, or check only the supplied page
fixflags check https://your-app.com --no-wait
fixflags check https://your-app.com --single

# Run a fresh check and return the verification diff + next Fix list
fixflags recheck <reportId> --wait --diff

# Protected preview deploys (Studio)
fixflags check https://preview.up.railway.app --wait --basic-auth user:password
fixflags check https://preview.up.railway.app --wait --cookie "session=value"
fixflags check https://preview.up.railway.app --wait --scan-access-file ./scan-access.json

# Structured output for agents and CI
fixflags check https://your-app.com --json
fixflags recheck <reportId> --json

# Inspect a running check
fixflags status <reportId>

# Inspect or disconnect the active account
fixflags whoami
fixflags logout
```

`check` waits by default, returns every unresolved fix, and exits non-zero when
the completed report contains a critical Flag. `recheck` always performs a fresh capture and
returns fixed, remaining, new, and regressed counts.

## What it checks

- **Message:** headline clarity, CTA specificity, audience fit, and social proof
- **Experience:** layout, mobile UX, accessibility, and broken interactions
- **Reach:** SEO metadata, social previews, privacy policy, and analytics

The default human-readable result bounds each fix prompt. Use `--full` for complete prompts or
`--json` for structured automation.

## MCP tools used

- `ff_check_and_plan`
- `ff_get_check_status`
- `ff_get_report`
- `ff_get_current_finish_plan`
- `ff_recheck_and_compare`

## Development

```bash
npm test
```

## Links

- [FixFlags](https://fixflags.com)
- [Help Center](https://fixflags.com/help)
- [API Keys](https://fixflags.com/settings/api-keys)
