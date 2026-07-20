# Help Center IA

**Date:** 2026-07-20

## Peer patterns

- Anthropic/OpenAI/Cursor: **Help Center** naming, topic collections, search first, messenger escalation.
- Stripe/Vercel: **Docs** for developer depth + `llms.txt`.
- FixFlags already owned first-party chat in Postgres.

## Choice

Ship **Help Center** at `/help` in-repo (`lib/help/`), escalate via existing live chat (`openSupportChat`), keep `/faq` as short Q&A, canonicalize MCP at `/help/mcp`. Do not adopt Intercom/Zendesk/Plain until chat volume outgrows part-time human reply. Do not ship AI Fin until help retrieval exists.

## Maintenance

- Article bodies: `lib/help/catalog.ts`
- Chrome/SLA: `HELP_CENTER`, `SUPPORT_CHAT` in `copy.ts` + `lib/help/sla.ts`
- Point-of-need maps: `lib/help/contextual.ts`
- New stuck surfaces must link help + chat (completeness skill).
