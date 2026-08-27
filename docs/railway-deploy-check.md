# Railway deploy check

Enqueue a FixFlags Launch Check when a Railway deployment succeeds.

FixFlags itself runs on Railway; this is the supported post-deploy gate for your app (no GitHub Action or Vercel webhook required).

## Setup

1. Create a FixFlags API key (Pro or Studio) from **Settings → API keys**.
2. Optional: set `RAILWAY_WEBHOOK_SECRET` on your FixFlags deployment and append `&webhookSecret=...` to the webhook URL.
3. In Railway → **Project → Settings → Webhooks**:
   - **URL:** `https://fixflags.com/api/webhooks/railway?apiKey=ff_live_...&url=https://YOUR-SERVICE.up.railway.app`
   - **Events:** successful deployment only (e.g. deploy success / completed)
4. Use your service public HTTPS domain for `url`. Railway webhooks do not always include the public URL in the payload.

Replace `fixflags.com` with your FixFlags host when self-hosting.

## Query parameters

| Param | Required | Description |
|-------|----------|-------------|
| `apiKey` | yes | FixFlags API key (`ff_live_...`) |
| `url` | yes | HTTPS URL to check after deploy |
| `webhookSecret` | when `RAILWAY_WEBHOOK_SECRET` is set | Shared secret matching FixFlags env |

Headers `x-fixflags-api-key`, `x-fixflags-check-url`, and `x-fixflags-webhook-secret` are also accepted.

## Behavior

- Ignores build, failure, and crash events.
- Enqueues a non-blocking Product Review.
- Returns `{ reportId, reportUrl, status }` on success.

## Alternative: release command

If you prefer not to use project webhooks, call the same endpoint from a Railway release phase or deploy hook:

```bash
curl -fsS -X POST \
  "https://fixflags.com/api/webhooks/railway?apiKey=$FIXFLAGS_API_KEY&url=https://${RAILWAY_PUBLIC_DOMAIN}"
```

Store `FIXFLAGS_API_KEY` in Railway service variables.

## CLI without webhooks

```bash
fixflags check "https://YOUR-SERVICE.up.railway.app" --wait
```

Use this for manual checks or custom Railway shell scripts.
