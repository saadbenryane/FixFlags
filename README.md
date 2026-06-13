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
# Edit .env.local — at minimum set ANTHROPIC_API_KEY and BETTER_AUTH_SECRET

# 3. Start Postgres + Redis
docker compose up -d

# 4. Apply database schema
npm run db:migrate

# 5. Run web app + audit worker together
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000), enter a public URL, and wait ~60s for results.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js only (audits stay queued without worker) |
| `npm run worker` | Audit worker only |
| `npm run dev:all` | Next.js + worker concurrently |
| `npm run setup` | Docker up + migrate + generate |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

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
        "Authorization": "Bearer qos_..."
      }
    }
  }
}
```

See [MCP docs](/docs/mcp) for full tool reference.

## Production deployment (Railway)

Deploy **two services** from this repo:

1. **Web** — `npm run build && npm start` (default)
2. **Worker** — `npm run worker:build && npm run worker:start`

Both services need the same env vars: `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, and auth/billing vars as configured.

## Voice and copy

[`docs/voice-and-copy.md`](docs/voice-and-copy.md)
