# FixFlags: Archon head notes

The project's own `AGENTS.md` at the checkout root is the authority on working rules. This file only adds orientation and never replaces it.

## Identity

FixFlags is an independent monitor for software that acts. It watches the outcomes a business depends on and raises "Flags" with evidence when something breaks. Stack: Next.js app, Postgres (Prisma), Redis, a dedicated Playwright audit worker, an MCP endpoint and a CLI. Public site: https://fixflags.com.

## Invariants (from the project's own guide)

- Check `git status --short` before writing. The tree often holds unrelated uncommitted work from other writers. Never reset, clean, stash or overwrite it.
- No em dashes in responses, copy, docs or comments.
- No line separators in UI. Group with whitespace, type and surface tone (`DESIGN.md`).
- Code and tests describe current behavior. Plans, reviews, handoffs and history are evidence only. Do not present planned behavior as shipped.
- Read `SECURITY.md` before auth, billing, sharing, webhooks, encryption, middleware or tenant access changes.
- Run end-to-end (Playwright) tests only when the user asks. Prefer the smallest focused check.
- Exact customer copy lives in `lib/marketing/copy/`.
- Read the matching guide in `node_modules/next/dist/docs/` before changing Next.js APIs.

## Boot order

1. `.archon/INDEX.md`
2. Root `AGENTS.md`
3. `CANONICAL-SOURCES.md` (which doc owns which topic)
4. `README.md` and `DEVELOPMENT.md` for setup and commands
5. `PRODUCT.md` for current behavior, then `ROADMAP.md` for direction
6. Task-specific: `npm run agent -- context <area>`

## Promotion map

- Setup and run facts go to `DEVELOPMENT.md` or `README.md`, not here.
- Product direction goes to `knowledge/vision.md` and `docs/`.
- Durable decisions go to `DECISIONS.md`.
- Security rules go to `SECURITY.md`.
- Pointers to where truth lives go to `.archon/INDEX.md`. Do not copy the content.
