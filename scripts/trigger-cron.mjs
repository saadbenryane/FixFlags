// One-shot cron trigger used by the Railway cron service (railway.cron.toml).
// Calls an internal cron endpoint with the shared CRON_SECRET and exits, so
// scheduled recovery does not depend on GitHub Actions. Uses Node 20's global
// fetch (no curl dependency in the slim runtime image).
//
// Usage: node scripts/trigger-cron.mjs [/api/cron/<name>]
// Env:   APP_URL (or NEXT_PUBLIC_APP_URL), CRON_SECRET

const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
const secret = process.env.CRON_SECRET
const path = process.argv[2] || '/api/cron/recover-stuck-audits'

if (!base || !secret) {
  console.error('[cron] Missing APP_URL (or NEXT_PUBLIC_APP_URL) or CRON_SECRET')
  process.exit(1)
}

const url = `${base.replace(/\/$/, '')}${path}`

try {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(60_000),
  })
  const body = await res.text()
  console.log(`[cron] GET ${path} -> ${res.status} ${body.slice(0, 500)}`)
  process.exit(res.ok ? 0 : 1)
} catch (err) {
  console.error(`[cron] GET ${path} failed:`, err instanceof Error ? err.message : err)
  process.exit(1)
}
