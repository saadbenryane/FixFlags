# Railway deploy check

After a successful Railway deployment, FixFlags runs the important Outcomes on the Site you already own. The API key identifies your account. The public host must match that Site. Credentials belong in headers, not the webhook URL.

## Setup

1. Create a FixFlags API key from **Settings → API keys** on the account that owns the Site.
2. Optional: set `RAILWAY_WEBHOOK_SECRET` on FixFlags and send the same value as `x-fixflags-webhook-secret`.
3. In Railway → **Project → Settings → Webhooks**:
   - **URL:** `https://fixflags.com/api/webhooks/railway`
   - **Events:** successful deployment only
4. Configure the webhook to send:
   - `Authorization: Bearer ff_live_...`
   - `x-fixflags-check-url: https://YOUR-SERVICE.up.railway.app`

Railway does not always include the public URL in the payload, so the check URL header is required. A query-string API key is rejected.

## Behavior

- Ignores build, failure, and crash events.
- Runs every required Outcome binding through the shared Site command. A repeated delivery of the same deployment reuses that run.
- When the Site has no required binding, FixFlags runs diagnostic Site care and does not mark an Outcome clear.
- Returns `{ siteId, runId, auditId, mode }` on success.
- Returns 404 when the host is not an owned Site.

## Alternative: release command

```bash
curl -fsS -X POST "https://fixflags.com/api/webhooks/railway" \
  -H "Authorization: Bearer $FIXFLAGS_API_KEY" \
  -H "x-fixflags-check-url: https://${RAILWAY_PUBLIC_DOMAIN}"
```

Store `FIXFLAGS_API_KEY` in Railway service variables.

## Coding agent

A connected coding agent requests the same run with `ff_run` and reads the result with `ff_get_run`. The agent supplies a Site id and an idempotency key. Polling can resume after a disconnect. A revoked or wrong-audience token is rejected.
