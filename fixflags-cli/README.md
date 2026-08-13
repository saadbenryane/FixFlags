# FixFlags CLI

Product Intelligence for AI-built products. A thin, task-shaped client over the FixFlags MCP API.

## Quick start

```bash
# Check any URL and get a bounded Finish Plan — no account required
npx fixflags check https://your-app.com

# Connect to your account (optional, unlocks history and update reviews)
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
# Check a URL and return the highest-leverage Finish Plan
fixflags check https://your-app.com --wait --plan

# Return the complete ranked Fix List
fixflags check https://your-app.com --all

# Print complete prompt text instead of bounded previews
fixflags check https://your-app.com --full

# Queue without waiting, or check only the supplied page
fixflags check https://your-app.com --no-wait
fixflags check https://your-app.com --single

# Run a fresh update review and return the verification diff + next Fix List
fixflags recheck <reportId> --wait --diff

# After implementing a Flag, record the change as ready for independent verification
fixflags attempt <flagId> --summary "Clarified the primary CTA" --deployment https://your-app.com

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

`check` waits by default, returns a one-to-three item Finish Plan, and exits non-zero when
the completed report contains a critical Flag.
Copying a builder handoff does not create an attempt.
Run `attempt` only after implementing a change; it records `READY_TO_VERIFY`, not a verified result.
`recheck` always performs a fresh capture and returns improved, remaining, new, and regressed counts.

## What it checks

- **Message:** headline clarity, CTA specificity, audience fit, and social proof
- **Experience:** layout, mobile UX, accessibility, and broken interactions
- **Reach:** SEO metadata, social previews, privacy policy, and analytics

Use `--all` for every unresolved Flag, `--full` for complete prompt text, or `--json` for structured automation.

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
