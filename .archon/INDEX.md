# FixFlags index

FixFlags is a working Next.js and Postgres web app, with a separate audit worker and a small CLI, that independently monitors the important outcomes a business depends on ("Your software runs. FixFlags watches."), and the checkout is in active development with many uncommitted changes.

## Facts

- **Public website:** https://fixflags.com (from `README.md`)
- **Run:** `npm run dev` starts Next.js plus one audit worker. It needs Node 22+, Docker for local Postgres and Redis, and `.env.local` copied from `.env.example`. Setup steps are in `README.md` and `DEVELOPMENT.md`.
- **Local address:** http://localhost:3000 once running (from `README.md`)
- **Health check:** `/api/health`. MCP endpoint: `/api/mcp`.

## Read first

- `README.md` for what it is and local setup
- `AGENTS.md` (the project's own repo guide, authoritative for working rules)
- `CANONICAL-SOURCES.md` for which document is the authority on each topic
- `PRODUCT.md` for what the code does today
- `ROADMAP.md` and `docs/product-masterplan.md` for the delivery plan
- `DEVELOPMENT.md` for environment and commands
- `SECURITY.md` before touching auth, billing, sharing, webhooks, encryption, middleware or tenant access
- `DESIGN.md` for UI rules

## Other truth

- `knowledge/vision.md`: accepted owner direction
- `docs/product-architecture.md`, `docs/product-prd.md`, `docs/workspace-interface.md`: product shape and requirements
- `DECISIONS.md`, `ARCHITECTURE.md`, `CODEMAP.md`, `QUALITY.md`, `test-strategy.md`
- `docs/voice-and-copy.md`: customer language; exact rendered copy is in `lib/marketing/copy/`
- `.agents/README.md`: coordination between agents; `npm run agent -- context <area>` gives an authority map for one area
- `.github/workflows/`: CI and release workflows

## Code entry points

- `app/`: Next.js routes (`(app)`, `(marketing)`, `sites`, `api`, `admin`)
- `worker/index.ts`: audit worker
- `lib/`: domain code (audit, sites, marketing copy)
- `prisma/`: database schema
- `fixflags-cli/`: command line client
- `e2e/`: Playwright tests (run only when asked, per `AGENTS.md`)

## Status

- No native skill folders found (`.agents/skills`, `.claude/skills`, `.cursor/skills` are absent).
- No `CURRENT.md` found.
