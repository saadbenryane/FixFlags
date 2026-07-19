# Development

*Verified setup, commands, and operational procedures.*

## Prerequisites

- Node.js 20+
- Docker (local Postgres 16 + Redis 7)
- npm

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local: at minimum set OPENAI_API_KEY or ANTHROPIC_API_KEY and BETTER_AUTH_SECRET
docker compose up -d
npm run setup          # docker up + generate + migrate + seed
npm run dev            # Next.js + inline worker (audits process end-to-end)
```

Open http://localhost:3000, enter a public URL, wait ~60s for results.

## Environment variables

Required for dev: `DATABASE_URL`, `REDIS_URL`, either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (`http://localhost:3000`), `NEXT_PUBLIC_APP_URL` (`http://localhost:3000`).

See `.env.example` for full list.

## Commands

### Development
| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev + inline worker |
| `npm run dev:all` | Next.js + separate worker process |
| `npm run worker` | Standalone audit worker (dev) |
| `npm run stripe:listen` | Stripe webhook forwarding (requires Stripe CLI) |

### Database
| Command | Purpose |
|---------|---------|
| `npm run db:migrate` | Apply Prisma migrations (dev) |
| `npm run db:deploy` | Apply Prisma migrations (prod) |
| `npm run db:seed` | Seed local admin user |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:check` | Check migration status |
| `npm run db:drift` | Check schema drift |
| `npm run db:validate` | Validate Prisma schema |
| `npm run db:push` | Push schema directly (dev only) |

### Quality
| Command | Purpose |
|---------|---------|
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint (core-web-vitals + a11y + import) |
| `npm run test:unit` | Vitest (lib/**/*.test.ts, node env) |
| `npm run test:watch` | Vitest watch mode |
| `npm run brand:hex-guard` | Enforce brand hex color compliance |
| `npm run ui:drift-guard` | Detect UI drift from design system |
| `npm run seo:guard` | SEO compliance checks |
| `npm run verify` | All quality checks: validate + migration status + drift + typecheck + lint + guards + test + build |

### Demo / testing
| Command | Purpose |
|---------|---------|
| `npm run demo:audit:offline` | Demo fixture audit (CLI, no server) |
| `npm run demo:audit:flow` | Flow audit on demo fixture |
| `npm run demo:audit` | Demo audit against dev server |
| `npm run smoke:triage:prod` | Post-deploy prod smoke (health + triageAt assertion) |
| `npm run audit:capabilities` | Report check module coverage |

### Build
| Command | Purpose |
|---------|---------|
| `npm run build` | Production Next.js build |
| `npm run worker:build` | Worker TypeScript build |
| `npm run worker:start` | Start built worker |

### Backfill / ops
| Command | Purpose |
|---------|---------|
| `npm run backfill:leads` | Backfill lead data |
| `npm run graph:backfill` | Backfill knowledge graph from historical audits |
| `npm run growth:rollup-issues` | Compute issue frequency rollups |
| `npm run growth:pull-gsc` | Pull Google Search Console data |
| `npm run growth:self-seed` | Self-seed knowledge graph with known sites |
| `npm run growth:backfill-tech` | Backfill technology detection |

### Auth
| Command | Purpose |
|---------|---------|
| `npm run auth:check` | Verify auth env configuration |
| `npm run signups` | Count signups |

### Sandbox worktrees

For parallel agent work, create isolated worktrees:

```bash
git worktree add ../qewos-<task-id> agent/<task-id>-<description>
# In the worktree directory:
cp ../qewos/.env.local .env.local  
# Edit DATABASE_URL if using sandbox database
npm install
npm run setup
npm run dev -p 3001
```

Use the sandbox databases defined in `.claude/launch.json`:
- `dev-sandbox` (port 3001) and `dev-sandbox-2` (port 3002) each set their own isolated `DATABASE_URL`; see `.claude/launch.json` for the exact connection strings. The primary local DB (`fixflags`) is defined in `docker-compose.yml` and `.env.example`.

## Debugging

- Health check: `curl http://localhost:3000/api/health` (DB, `storageConfigured`, `aiConfigured`)
- AI readiness: `GET /api/health/ai`
- Worker diagnostics: `GET /api/health/worker` (heartbeat age, queue depth)
- Browser diagnostics: `GET /api/health/browser` (Playwright + R2)
- Audit pipeline: see `docs/audit-pipeline.md`
- Prisma Studio: `npm run db:studio`
- Worker logs: pino JSON, pipe through `pino-pretty` in dev
- Screenshots: stored in `.data/screenshots/` locally, served at `/api/screenshots/{auditId}/{device}`

## Common failures

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Error: NEXT_PUBLIC_APP_URL is required` | Running CLI script without `.env.local` | Use `DOTENV_CONFIG_PATH=.env.local` prefix |
| "scanner temporarily unavailable" | Missing R2 config in production | Set all `R2_*` env vars |
| Scan completes but no AI score/verdict | Missing `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Set on Railway web service, redeploy. Check `/api/health` `aiConfigured` |
| PageSpeed partial / 429 | No `PAGESPEED_API_KEY` | Set key in Railway; retries added in pipeline |
| Audits stuck in QUEUED | Redis not running | `docker compose up -d` |
| Audits stuck then fail | Worker down past give-up window | Check `/api/health/worker`; see `recover-audit-job.ts` |
| OAuth buttons hidden | Google/GitHub env vars not set at runtime | Set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| `better-auth.session_token` mismatch | Cookie name difference | Check `proxy.ts` matcher (handles both dev and `__Secure-` prefix) |
| Build fails with TS2589 | Deep type instantiation | Check `zodToJsonSchema` calls; add explicit type annotation |

### Railway AI keys (production)

1. Railway dashboard → FixFlags web service → Variables
2. Set `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`
3. Redeploy (SDK clients init at module load)
4. Verify: `curl https://fixflags.com/api/health` → `"aiConfigured":true`
5. Smoke: `npm run smoke:triage:prod`

## Local admin

Email: `saadbenryane@gmail.com` / password: `password123`
- Unlimited scans
- `/admin` dashboard with run costs
- Created by `npm run db:seed`

## Production deployment (Railway)

Railway builds via **Dockerfile** (`railway.toml` `builder = "DOCKERFILE"`), not Nixpacks. Inside the image, `CMD` runs `npm start` (with `prestart` → `db:deploy`).

```bash
# Local parity with Railway image (required when Dockerfile / package*.json change)
docker build -t fixflags:local .

# What runs inside the container (web service default)
npm start
# INLINE_WORKER defaults on; prestart applies Prisma migrations via DATABASE_URL

# Dedicated worker (separate Railway service from railway.worker.toml)
INLINE_WORKER=false npm run worker:start
```

**Docker / Playwright:** image installs apt `chromium`, sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Auth packages are pinned in `package.json` `overrides` (better-auth 1.6.22 + Zod 4). If you add an `.npmrc`, COPY it **before** `npm ci` in the Dockerfile.

Required production env vars: `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY` (or Anthropic), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, R2 vars, Stripe vars, `CRON_SECRET`, `RESEND_API_KEY`.

CI: GitHub Actions (`ci.yml`) runs typecheck, lint, guards, `test:unit`, `build`, and `worker:build`. It does **not** run DB migration checks or `docker build`. Local `npm run verify` is stricter; run `docker build` before push when deploy packaging files change.

## Screenshot regeneration

```bash
# Dev server on :3000 required
SAMPLE_CAPTURE_URL=http://localhost:3000/demo npx tsx scripts/capture-sample-screenshots.ts

# Full marketing sample refresh (requires Postgres + API keys)
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/refresh-marketing-sample.ts
```
