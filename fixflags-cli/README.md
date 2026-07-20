# FixFlags CLI

QA for AI-built products. Scan any web app across Message, Experience, and Reach.

## Status

Package lives in-repo at `fixflags-cli/`. Prefer local/`npx` from this package until published to npm.

```bash
# From this directory
npm install
npx tsx src/index.ts scan https://your-app.com

# Or after build
npm run build && node bin/fixflags.js scan https://your-app.com
```

Do not document `npm install -g fixflags` as the primary path until the package is published.

## Setup

```bash
fixflags auth --api-key <your-key>
# Get your API key at https://fixflags.com/settings (Pro or Agency)
```

Set `FIXFLAGS_API_URL` to target a non-prod API (default `https://fixflags.com`).

## Usage

```bash
# Scan a URL (waits for results)
fixflags scan https://your-app.com

# Scan a single page only
fixflags scan https://your-app.com --single

# Raw JSON (CI-friendly)
fixflags scan https://your-app.com --json

# Exit code 1 when any CRITICAL flag is present (default for --json and human output)
fixflags scan https://your-app.com --json

# Check scan status
fixflags status <reportId>
```

## What it checks

- **Message** — Headline clarity, CTA specificity, audience fit, social proof
- **Experience** — Layout, mobile UX, accessibility, broken interactions
- **Reach** — SEO metadata, social previews, privacy policy, analytics

Each issue includes a fix prompt for Cursor, Claude Code, Lovable, or Bolt.

## CI/CD

```bash
# Fail the job when CRITICAL flags exist
npx tsx src/index.ts scan https://staging.your-app.com --json
# Exit code is non-zero if CRITICAL flags are present
```

## MCP tools used

The CLI calls the FixFlags MCP HTTP API with:

- `ff_check_url`
- `ff_get_check_status`
- `ff_get_report`

## Links

- [FixFlags](https://fixflags.com)
- [Help Center](https://fixflags.com/help)
- [API Keys](https://fixflags.com/settings)
