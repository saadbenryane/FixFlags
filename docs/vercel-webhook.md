# Vercel deployment webhook

Enqueue a FixFlags Launch Check when a Vercel deployment succeeds.

## Setup

1. Generate a webhook secret: `openssl rand -hex 32`
2. Set `VERCEL_WEBHOOK_SECRET` on the FixFlags deployment.
3. Create a FixFlags API key (Pro or Agency) from **Settings → API keys**.
4. In Vercel → **Project → Settings → Webhooks**:
   - **URL:** `https://fixflags.com/api/webhooks/vercel?apiKey=ff_live_...`
   - **Events:** Deployment Succeeded
   - **Secret:** same value as `VERCEL_WEBHOOK_SECRET`

Vercel cannot send custom headers, so the API key must be in the webhook URL query string. The `x-vercel-signature` header still verifies payload authenticity.

## Behavior

- Ignores events other than `deployment.succeeded`.
- Enqueues a `CRITICAL_PATH` check for the deployment URL (non-blocking).
- Returns `{ reportId, reportUrl, status }` on success.

## GitHub Actions alternative

For GitHub-hosted previews, use `actions/fixflags-check` instead. See `actions/fixflags-check/README.md`.
