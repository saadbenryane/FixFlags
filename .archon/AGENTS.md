# FixFlags: Archon working guide

This file tells Archon how to work in this checkout. The project's own rules live in the root `AGENTS.md`, which is canonical and is not changed here.

## Identity

- FixFlags is the product: an independent monitor for the outcomes a business depends on. PiWeb is a development and session interface, not a customer product.
- The checkout is a Next.js 16 App Router app with Prisma, Postgres, Redis and BullMQ, plus a separate worker process.

## Invariants

- Never use em dashes in responses, product copy, documentation or comments.
- When the owner gives exact wording, preserve it. Do not paraphrase it.
- Run `git status --short` before writing. Preserve unrelated changes. Never reset, clean, stash or overwrite another writer's changes.
- Run end-to-end (Playwright) suites only when the owner explicitly asks for them.
- Current behavior comes from code and tests. Plans, reviews, sessions and history are evidence, not instructions. Do not present planned behavior as shipped.
- Auth, billing, sharing, webhooks, encryption, middleware and tenant access: read `SECURITY.md` first.

## Boot order

1. Root `AGENTS.md` (project rules, canonical).
2. `.archon/INDEX.md` (where truth lives).
3. `CANONICAL-SOURCES.md` (which document owns which concept, and the conflict order).
4. Only the authority doc the task needs, then the code and focused tests.

## Promotion map

- Product purpose and audience: `knowledge/vision.md`.
- Customer objects and navigation: `docs/product-architecture.md`.
- Public words: `docs/voice-and-copy.md`. Exact rendered strings: `lib/marketing/copy/`.
- Current implementation: `PRODUCT.md`. Engineering layout: `CODEMAP.md`, `ARCHITECTURE.md`.
- Run and development procedure: `DEVELOPMENT.md`.
- Sequence and delivery gates: `docs/product-masterplan.md`, `ROADMAP.md`.
- Durable decisions: `DECISIONS.md`.

New lasting project facts go into those canonical files, not into `.archon`. `.archon` holds only pointers and orientation.

## Known state

- Current milestone (per `ROADMAP.md`): website public validation, one-website open beta.
- No deployment is attested by the source review. Treat production state as unknown until checked.
