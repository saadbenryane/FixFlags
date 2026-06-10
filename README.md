# QualityOS

**Your agent built it. QualityOS checks if it works.**

QualityOS runs a quality audit on any public website and returns evidence-backed findings across 7 areas — Performance, Accessibility, SEO, Conversion, Trust, Content, and Mobile. Every finding ships with a copy-paste fix prompt for Cursor, Claude Code, Lovable, or Bolt, and you can re-check after fixing to verify the issue is actually gone.

## How it works

1. **Capture** — a Puppeteer worker screenshots the page (desktop + mobile) and collects console errors.
2. **Check** — deterministic checks run against page metadata and Google PageSpeed data.
3. **Judge** — Claude reviews the screenshots and check results, grades each area, and writes agent-ready fix prompts.
4. **Re-check** — run the audit again after fixing and get a before/after comparison of scores, grades, and screenshots per area.

## Stack

- **Next.js 15** (App Router) + React 19 + Tailwind
- **PostgreSQL** via Prisma
- **Redis** + BullMQ job queue with a separate worker process
- **better-auth** (email/password + optional Google/GitHub OAuth)
- **Stripe** subscriptions (Free / Builder / Team / Studio)
- **Anthropic API** for the AI judge
- **Cloudflare R2** (optional) for screenshot storage
- **MCP server** at `/api/mcp` so agents can run audits directly

## Local development

Requirements: Node 20+, PostgreSQL, Redis.

```bash
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, BETTER_AUTH_SECRET
npm install
npx prisma db push     # create the schema
npm run dev            # web app on :3000
npm run worker         # audit worker (separate terminal)
```

Sign up at `http://localhost:3000/sign-up`, then paste a URL on the dashboard.

## Deployment (Railway or similar)

Two services from this repo, plus Postgres and Redis:

| Service | Build | Start |
|---|---|---|
| Web | `npm run build` | `npm start` |
| Worker | `npm run worker:build` | `npm run worker:start` |

- `railway.toml` / `nixpacks.toml` are included (the worker needs the Chromium system deps listed in `nixpacks.toml`).
- Run `npx prisma migrate deploy` (or `db push`) on deploy.
- Point a Stripe webhook at `/api/webhooks/stripe` with events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Health check: `GET /api/health` (verifies DB + Redis).

## MCP integration

Agents can run audits via the MCP endpoint — see `/docs/mcp` in the app. API keys are created at `/settings/api-keys`.

## Environment variables

See [.env.example](.env.example) for the full list with comments. Only `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, and `NEXT_PUBLIC_APP_URL` are required; Stripe, OAuth, R2, and PageSpeed keys are optional and the app degrades gracefully without them.
