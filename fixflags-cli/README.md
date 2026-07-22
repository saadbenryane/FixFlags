# FixFlags CLI

Product Intelligence for AI-built products. A thin, task-shaped client over the FixFlags MCP API.

## Status

The supported beta is built and published from `fixflags-cli/` as `fixflags@beta`.

```bash
# Before the first registry release, from this directory
npm install
npm run build
node bin/fixflags.js check https://your-app.com
```

## Setup

```bash
fixflags auth --api-key <your-key>
# Create a key at https://fixflags.com/settings/api-keys (Pro or Agency)
```

For CI, set `FIXFLAGS_API_KEY` instead of writing a local config file. Set
`FIXFLAGS_API_URL` to target a non-production API. The default is `https://fixflags.com`.

## Usage

```bash
# Check a URL and return its top three improvements
fixflags check https://your-app.com --wait --plan

# Print complete fix prompts instead of bounded previews
fixflags check https://your-app.com --full

# Queue without waiting, or check only the supplied page
fixflags check https://your-app.com --no-wait
fixflags check https://your-app.com --single

# Run a fresh check and return the verification diff + next Finish Plan
fixflags recheck <reportId> --wait --diff

# Structured output for agents and CI
fixflags check https://your-app.com --json
fixflags recheck <reportId> --json

# Inspect a running check
fixflags status <reportId>
```

`check` waits by default, returns a maximum of three Finish Plan items, and exits non-zero when
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
