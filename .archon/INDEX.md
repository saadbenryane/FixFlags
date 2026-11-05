# FixFlags index

FixFlags is an independent monitor for the outcomes a business depends on, and this checkout is a real, substantial Next.js application with its product, engineering and run documents present on disk.

## Read first

- [README.md](../README.md): product summary, local setup, scripts and deployment notes.
- [DEVELOPMENT.md](../DEVELOPMENT.md): run, stop and verify procedure.
- [CANONICAL-SOURCES.md](../CANONICAL-SOURCES.md): which document owns each concept.
- [AGENTS.md](../AGENTS.md): the project's own working rules (native, do not overwrite).

## Product truth

- [knowledge/vision.md](../knowledge/vision.md): purpose and audience.
- [docs/product-architecture.md](../docs/product-architecture.md): Site, Outcomes, Flags, history.
- [docs/product-prd.md](../docs/product-prd.md): behavior requirements.
- [docs/voice-and-copy.md](../docs/voice-and-copy.md): customer language.
- [PRODUCT.md](../PRODUCT.md): what the code does today.
- [ROADMAP.md](../ROADMAP.md) and [docs/product-masterplan.md](../docs/product-masterplan.md): sequence and current delivery gates.

## Engineering truth

- [ARCHITECTURE.md](../ARCHITECTURE.md) and [CODEMAP.md](../CODEMAP.md): system and code layout.
- [SECURITY.md](../SECURITY.md): auth, billing, webhooks, tenant access.
- [QUALITY.md](../QUALITY.md): proportional checks and release proof.
- [DECISIONS.md](../DECISIONS.md): durable decisions.
- [docs/release-evidence-runbook.md](../docs/release-evidence-runbook.md): open release gates.

## Entry points in the repo

- `app/`: Next.js App Router (marketing, auth, app, admin, API routes).
- `worker/index.ts`: the dedicated audit and scheduled-work worker.
- `prisma/schema.prisma`: database schema.
- `scripts/dev-runtime.mjs`: the managed `npm run dev` runtime.

## Run

`npm run dev` after `docker compose up -d --wait` and a configured `.env.local`. Starts Next.js and one supervised worker. Local URL: `http://localhost:3000`. Full steps are in [DEVELOPMENT.md](../DEVELOPMENT.md).

## Public site

`https://fixflags.com` is named as production in [README.md](../README.md). Whether it is live now is not verified here.

## Native agent roots

- `.codex/` and `public/.well-known/skills/fixflags/SKILL.md` (customer skill).
- `.cursor/` contains only `mcp.json`, not a skills directory.
