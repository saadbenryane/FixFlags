# FixFlags

The release readiness layer for AI-built products. Finish what your AI started: paste a URL, get Flags across Message, Experience, and Reach, with fix prompts for your AI editor.

## Prerequisites

- Node.js 20+
- Docker (for local Postgres + Redis)

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local, at minimum set OPENAI_API_KEY or ANTHROPIC_API_KEY and BETTER_AUTH_SECRET

# 3. Start Postgres + Redis
docker compose up -d

# 4. Apply database schema and seed local admin
npm run db:migrate
npm run db:seed

# 5. Run the app (the web server runs the audit worker in-process)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a public URL, and wait ~60s for results.

**Report surfaces:** `/report/{id}` is the focused three-item Finish Plan. `/report/{id}/details` contains Product context, journey and flow evidence, the full Flag explorer, previews, gates, and advanced actions. See `knowledge/report-contract.md`.

**Screenshots (local dev):** Audits persist desktop and mobile viewport captures to `.data/screenshots/` and serve them at `/api/screenshots/{auditId}/{device}`. Set `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000` in `.env.example`). Production uploads to Cloudflare R2 instead.

**Sample report assets:** Demo fixture lives at `/demo` (original) and `/demo/v1` (improved fork). Regenerate static sample WebPs with:

```bash
# Dev server must be running on port 3000
SAMPLE_CAPTURE_URL=http://localhost:3000/demo npx tsx scripts/capture-sample-screenshots.ts
```

Regenerate the versioned curated marketing snapshot from a completed `fixflags.com/demo` check. This is an explicit maintainer operation; homepage rendering never queries production audit rows:

```bash
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/refresh-marketing-sample.ts
```

Review the generated snapshot and its visual regression before replacing the checked-in version. Do not silently fall back during marketing rendering.

**Local admin:** Set `SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` in `.env.local`, then run `npm run db:seed`.

**Development note:** When `NODE_ENV=development`, scan limits are disabled so you can iterate without hitting billing caps.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js + inline audit worker (audits process end-to-end) |
| `npm run worker` | Standalone audit worker only |
| `npm run dev:all` | Next.js + a separate worker process concurrently |
| `npm run dev:full` | Alias for `dev:all` |
| `npm run setup` | Docker up + migrate + generate + seed |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed local admin user |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` | ESLint (Next.js core-web-vitals) |

### Health check

```bash
curl http://localhost:3000/api/health
```

Expect `db: ok`, `redis: ok`, and queue stats when everything is running.

## MCP integration

FixFlags exposes an HTTP MCP endpoint at `/api/mcp`. Create an API key at `/settings/api-keys` (Builder plan+), then configure your agent:

```json
{
  "mcpServers": {
    "fixflags": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "x-api-key": "ff_live_..."
      }
    }
  }
}
```

See [MCP docs](/docs/mcp) for full tool reference.

### Agent CLI

The in-repo `fixflags-cli/` package turns the common agent workflow into two
task-shaped commands over the same MCP endpoint:

```bash
fixflags check https://your-app.com --wait --plan
fixflags recheck <reportId> --wait --diff
```

`check` returns the current three-item Finish Plan. `recheck` performs a fresh
capture and returns the verification diff plus the next Finish Plan. See
[`fixflags-cli/README.md`](fixflags-cli/README.md) for local setup and JSON output.

**OAuth sign-in:** Set both `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (and/or GitHub equivalents) in `.env.local`. Sign-in and sign-up pages show Google/GitHub buttons automatically.

## Production deployment (Railway)

**One service is enough.** Railway builds the **Web** service from `Dockerfile` (`railway.toml`). The image `CMD` runs `npm start` (`prestart` applies migrations). By default it also runs the audit worker in-process (`INLINE_WORKER` defaults on) plus a self-hosted scheduler that recovers stuck audits and sends nurture emails; no separate worker and no external cron required. When `Dockerfile` or `package*.json` change, run `docker build -t fixflags:local .` before push.

- Liveness: `GET /api/health`. Deployment promotion uses strict `GET /api/health/ready` and receives 503 until all launch-required subsystems are ready.
- Worker/queue diagnostics: `GET /api/health/worker` (heartbeat age, Redis, queue depth). Use this to confirm the worker is alive.
- Scanning diagnostics: `GET /api/health/browser` (launches Chromium + screenshots, checks R2 connectivity). If every scan fails with "scanner temporarily unavailable", curl this first — it pinpoints whether the browser or storage subsystem is broken.
- Worker heartbeat is owned by `lib/queue/worker.ts` (writes every 20s, 45s TTL in Redis).

> R2, a live worker, Chromium, AI, PageSpeed, production auth, billing, email, and Product Watch dependencies are launch requirements. Production validation and `/api/health/ready` reject partial configuration; local development can still run an explicitly visible degraded mode.

**SSO:** Google/GitHub buttons appear automatically once `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (or the GitHub pair) are set on the deployed service — availability is resolved at runtime via `GET /api/auth/providers`, so **no rebuild is needed**. Register the callback `https://fixflags.com/api/auth/callback/google` and run `npm run auth:check` to verify.

**Scaling scanning** (optional): set `INLINE_WORKER=false` on the web service and deploy one or more dedicated **Worker** services (`railway.worker.toml`, `npm run worker:build && npm run worker:start`). All workers consume the same Redis queue; recovery runs in whichever workers are alive, guarded by a Redis lock, so it scales to any number of workers.

Optional worker env: `AUDIT_WORKER_CONCURRENCY` (default `5`; use ~`2` on a small single-service instance).

All services share the same `DATABASE_URL` and `REDIS_URL`.

> GitHub Actions and local full verification share `scripts/validate.mjs`. Use `npm run verify:release` for the clean-install, browser, Docker, and deployed readiness bar.

Local dev: `npm run dev` runs Next.js **and** the inline worker, so audits process end-to-end with a single command (set `INLINE_WORKER=false` to use `npm run dev:all` with a separate worker instead).

### Required production env vars

Both services need:

- `DATABASE_URL`, `REDIS_URL`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` (production: `https://fixflags.com`)
- **R2** (screenshots in production): `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs (see `.env.example`)
- **Cron**: `CRON_SECRET`
- **Email**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- **Marketing sample regeneration only**: `SAMPLE_AUDIT_URL` for the explicit refresh script. Runtime marketing pages use the checked-in curated snapshot.

Optional: `ADMIN_NOTIFICATION_EMAIL` for live chat admin notifications.

**Demo fixture SEO:** `/demo` and `/demo/v1` are `noindex` and disallowed in `robots.txt`. They are audit targets, not indexed marketing pages.

Live support (production):

- `ADMIN_NOTIFICATION_EMAIL` — required in production (visitor chat alerts)
- `SUPPORT_TENANT_SLUG` — defaults to `fixflags`

### Deploy checklist (leads + live support)

After schema changes on a fresh or upgraded database:

```bash
npm run db:deploy
npm run db:seed
npm run backfill:leads
```

Admin ops URLs: `/admin/leads`, `/admin/inbox`

### Scheduled jobs

These run **automatically inside the worker** via a self-hosted scheduler
(`lib/queue/recovery-scheduler.ts`), guarded by a Redis lock so exactly one
worker runs each per window. No external cron is required.

| Job | Cadence | Purpose |
|-----|---------|---------|
| Stuck-audit recovery | ~2 min | Re-queue or fail audits stuck in non-terminal states |
| Nurture emails | daily | Lifecycle emails to eligible users |

The matching HTTP routes (`/api/cron/recover-stuck-audits`, `/api/cron/nurture`)
remain for manual/external triggering, guarded by `Authorization: Bearer $CRON_SECRET`:

```bash
curl https://fixflags.com/api/cron/recover-stuck-audits \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Voice and copy

[`docs/voice-and-copy.md`](docs/voice-and-copy.md)

## Year 1 operating plan

[`docs/year-1-operating-plan.md`](docs/year-1-operating-plan.md) — North star, financial/customer/growth targets, product priorities, and quarterly milestones.
