# QualityOS

Post-build QA for AI-shipped apps. Paste a URL, get graded on performance, SEO, mobile, conversion, and trust, with fix prompts for your AI editor.

## Prerequisites

- Node.js 20+
- Docker (for local Postgres + Redis)

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — at minimum set OPENAI_API_KEY or ANTHROPIC_API_KEY and BETTER_AUTH_SECRET

# 3. Start Postgres + Redis
docker compose up -d

# 4. Apply database schema and seed local admin
npm run db:migrate
npm run db:seed

# 5. Run web app + audit worker together
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000), enter a public URL, and wait ~60s for results.

**Screenshots (local dev):** Audits persist desktop and mobile viewport captures to `.data/screenshots/` and serve them at `/api/screenshots/{auditId}/{device}`. Set `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000` in `.env.example`). Production uploads to Cloudflare R2 instead.

**Sample report assets:** Regenerate static sample WebPs with:

```bash
npx tsx scripts/capture-sample-screenshots.ts
```

**Local admin:** `saadbenryane@gmail.com` / `password123` (unlimited scans, `/admin` dashboard with run costs).

**Development note:** When `NODE_ENV=development`, scan limits are disabled so you can iterate without hitting billing caps.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js only (audits stay queued without worker) |
| `npm run worker` | Audit worker only |
| `npm run dev:all` | Next.js + worker concurrently |
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

QualityOS exposes an HTTP MCP endpoint at `/api/mcp`. Create an API key at `/settings/api-keys` (Builder plan+), then configure your agent:

```json
{
  "mcpServers": {
    "qualityos": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "x-api-key": "qos_live_..."
      }
    }
  }
}
```

See [MCP docs](/docs/mcp) for full tool reference.

**OAuth sign-in:** Set both `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (and/or GitHub equivalents) in `.env.local`. Sign-in and sign-up pages show Google/GitHub buttons automatically.

## Production deployment (Railway)

Deploy **two services** from this repo:

1. **Web** — `npm run build && npm start` (default)
2. **Worker** — `npm run worker:build && npm run worker:start`

### Required production env vars

Both services need:

- `DATABASE_URL`, `REDIS_URL`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
- **R2** (screenshots in production): `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs (see `.env.example`)
- **Cron**: `CRON_SECRET`
- **Email**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

Optional: `ADMIN_NOTIFICATION_EMAIL` for Expert Review purchase alerts.

### Cron jobs

Configure Railway (or any scheduler) to POST to these routes with header `Authorization: Bearer $CRON_SECRET`:

| Route | Purpose |
|-------|---------|
| `POST /api/cron/recover-stuck-audits` | Re-queue audits stuck in non-terminal states |
| `POST /api/cron/nurture` | Send lifecycle emails to eligible users |

Example:

```bash
curl -X POST https://your-app.com/api/cron/recover-stuck-audits \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Voice and copy

[`docs/voice-and-copy.md`](docs/voice-and-copy.md)
