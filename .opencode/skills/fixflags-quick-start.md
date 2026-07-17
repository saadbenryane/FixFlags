# FixFlags Quick Start

**Read `AGENTS.md` first.** It is the canonical source of truth for project facts, architecture, and verification commands.

## What FixFlags does

The QA layer for AI-built products. Paste a URL, get Flags across Message, Experience, and Reach, with fix prompts for your AI editor.

**Core loop:** Flag -> Fix -> Re-check. Every feature must serve this loop.

## Key commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js + inline worker (single command) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test:unit` | Vitest unit tests |
| `npm run verify` | All checks (requires Docker) |
| `npm run demo:audit:offline` | Demo audit (no server) |

## Architecture at a glance

- **Framework:** Next.js 15 App Router + React 19
- **Database:** PostgreSQL via Prisma 6 (40 models)
- **Queue:** BullMQ with Redis (inline + standalone worker)
- **AI:** OpenAI (gpt-4o-mini) primary, Anthropic fallback
- **Auth:** Better Auth (email + OAuth)
- **Billing:** Stripe (Free/Pro/Agency tiers)
- **Design:** Tailwind + shadcn/ui + custom tokens (`lib/design/tokens.css`)

## Critical files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Agent entry point (read first, always) |
| `lib/marketing/copy.ts` | All marketing copy (single source of truth) |
| `lib/design/tokens.css` | Design tokens |
| `lib/audit/checks/index.ts` | Check module barrel |
| `lib/audit/check-ids.ts` | All 129 check IDs |
| `lib/audit/runner.ts` | Audit pipeline orchestrator |
| `lib/auth/entitlements.ts` | Plan-gated feature access |
| `lib/billing/plans.ts` | Plan definitions |

## Rules

1. Never hardcode marketing copy -- use `lib/marketing/copy.ts`
2. Never use raw hex in components -- use CSS tokens
3. No em dashes in source (use `--` instead)
4. Re-checks are free and unlimited -- never gate them
5. Run `npm run typecheck` and `npm run lint` before claiming done
