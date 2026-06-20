# FixFlags

Finish what your AI started. Paste a URL, get Flags across Message, Experience, and Reach, with fix prompts for your AI editor.

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

# 5. Run web app + audit worker together
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000), enter a public URL, and wait ~60s for results.

**Phase 1 report sections:** Share & search preview cards, CTA flow timeline (`flowData` on Audit), slop and flow flags. Apply migration `20260616120000_audit_flow_data` via `npm run db:migrate` if upgrading an existing database.

**Screenshots (local dev):** Audits persist desktop and mobile viewport captures to `.data/screenshots/` and serve them at `/api/screenshots/{auditId}/{device}`. Set `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000` in `.env.example`). Production uploads to Cloudflare R2 instead.

**Sample report assets:** Demo fixture lives at `/demo` (original) and `/demo/v1` (improved fork). Regenerate static sample WebPs with:

```bash
# Dev server must be running on port 3000
SAMPLE_CAPTURE_URL=http://localhost:3000/demo npx tsx scripts/capture-sample-screenshots.ts
```

Refresh the full marketing sample (live audit on `fixflags.com/demo`, public flag, WebPs, and evidence pin anchors). Requires Postgres and API keys in `.env.local`:

```bash
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/refresh-marketing-sample.ts
```

Set `SAMPLE_INCLUDE_AI=false` to skip the AI judge step (deterministic checks only) if the judge step fails.

**Local admin:** `saadbenryane@gmail.com` / `password123` (unlimited scans, `/admin` dashboard with run costs).

**Development note:** When `NODE_ENV=development`, scan limits are disabled so you can iterate without hitting billing caps.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js only (audits stay queued without worker) |
| `npm run worker` | Audit worker only |
| `npm run dev:all` | Next.js + worker concurrently |
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

**OAuth sign-in:** Set both `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (and/or GitHub equivalents) in `.env.local`. Sign-in and sign-up pages show Google/GitHub buttons automatically.

## Production deployment (Railway)

Deploy **two services** from this repo:

1. **Web**, `npm run build && npm start` (default)
2. **Worker**, `npm run worker:build && npm run worker:start`

### Required production env vars

Both services need:

- `DATABASE_URL`, `REDIS_URL`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` (production: `https://fixflags.com`)
- **R2** (screenshots in production): `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs (see `.env.example`)
- **Cron**: `CRON_SECRET`
- **Email**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

Optional: `ADMIN_NOTIFICATION_EMAIL` for Expert Review purchase alerts and live chat admin notifications.

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

### Cron jobs

Configure Railway (or any scheduler) to POST to these routes with header `Authorization: Bearer $CRON_SECRET`:

| Route | Purpose |
|-------|---------|
| `POST /api/cron/recover-stuck-audits` | Re-queue audits stuck in non-terminal states |
| `POST /api/cron/nurture` | Send lifecycle emails to eligible users |

Example:

```bash
curl -X POST https://fixflags.com/api/cron/recover-stuck-audits \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Voice and copy

[`docs/voice-and-copy.md`](docs/voice-and-copy.md)
