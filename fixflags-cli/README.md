# FixFlags CLI

Product Intelligence for AI-built products. A thin, task-shaped client over the FixFlags MCP API.

## Quick start

```bash
# Check any URL — no account required
npx fixflags check https://your-app.com

# Connect to your account (optional, unlocks history and re-checks)
npx fixflags login
npx fixflags init https://your-app.com
```

`npx fixflags` runs without install. Browser login stores the credential in
the operating-system credential store. Use `fixflags login --with-token` to
paste a manually created API key. For CI, set `FIXFLAGS_API_KEY`.

`fixflags init` merges FixFlags-managed editor configuration without replacing
existing settings. Use `--dry-run`, `--editor`, `--scope`, and `--yes` for
review or automation.

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
- `ff_recheck_and_compare`
- `ff_mark_fix_attempted`

## Development

```bash
npm test
```

## Links

- [FixFlags](https://fixflags.com)
- [Help Center](https://fixflags.com/help)
- [API Keys](https://fixflags.com/settings/api-keys)
