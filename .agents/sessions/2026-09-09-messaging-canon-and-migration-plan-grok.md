# Messaging canon and migration plan

**Date:** 2026-09-09
**Task:** `messaging-canon-and-migration-plan`
**Owner:** grok
**Status:** documentation only. No production homepage, UI, notification, or component copy was changed.

## What this pass did

Codified the new FixFlags messaging system as the durable customer-language source of truth, then audited the repository against it and wrote a dependency-aware implementation plan.

Canon: [docs/voice-and-copy.md](../../docs/voice-and-copy.md)
Plan: [docs/messaging-migration.md](../../docs/messaging-migration.md)

Routing updated so a later agent does not need this conversation: `CANONICAL-SOURCES.md`, `AGENTS.md`, `knowledge/README.md`, `knowledge/vision.md` (pointer only; owner narrative preserved), `SOUL.md`, `ROADMAP.md`, `DESIGN.md`, `docs/product-prd.md`, `docs/workspace-interface.md`, `docs/card-board-experience.md`, `PRODUCT.md`, `EVOLUTION-RULES.md`, `knowledge/execution.md`, marketing/product/product-intelligence/design-system skills.

## What was not done

No `lib/marketing/copy/*.ts` string rewrites except a header comment on `lib/marketing/copy.ts`. No Site board, homepage, email, help, or notification implementation. `homepage-end-user-polish` and `board-card-chrome` working trees were left untouched.

## Evidence used

- Live homepage is `CareHomepage` + `care-homepage.ts`, not leftover `HERO` in `homepage.ts`.
- `ALL_CHECK_IDS` count is 201, so “100+ automated tests” is true.
- First board card area id `site` is named Site and already lists checked pages; Pages is an accurate rename.
- POLISH findings are still Flags. Recommendations are not a shipped object.
- General Flag notification modes do not exist. Shopify integrity email/Slack does.
- MCP is parked from the homepage; Copy prompt is the shipped AI path.
- Public 24/7 packaging and Help “weekly on Free” plus monthly audit pools disagree.

## Next

Execute [docs/messaging-migration.md](../../docs/messaging-migration.md) after review, starting with terminology primitives and test locks, not the homepage.
