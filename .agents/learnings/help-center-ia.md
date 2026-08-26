# Help Center IA

**Date:** 2026-07-20

## Peer patterns

- Anthropic/OpenAI/Cursor: **Help Center** naming, topic collections, search first, messenger escalation.
- Stripe/Vercel: **Docs** for developer depth + `llms.txt`.
- FixFlags already owned first-party chat in Postgres.

## Choice

Ship **Help Center** at `/help` in-repo (`lib/help/`), escalate via existing live chat (`openSupportChat`), keep `/faq` as short Q&A with canonical links, redirect legacy `/help/mcp` to `/help`. Do not adopt Intercom/Zendesk/Plain until chat volume outgrows part-time human reply. Do not ship AI Fin until help retrieval exists.

## Maintenance

- Article bodies: `lib/help/catalog.ts`
- Chrome/SLA: `HELP_CENTER`, `SUPPORT_CHAT` in `copy.ts` + `lib/help/sla.ts`
- Point-of-need maps: `lib/help/contextual.ts`
- Unified search: `lib/knowledge/search.ts` + `components/help/KnowledgeSearch.tsx`
- Structured data: `lib/marketing/structured-data.ts`
- IA reference: `docs/knowledge-base-ia.md`
- New stuck surfaces must link help + chat (completeness skill).

## 2026-08-26 updates

- `/help/mcp` redirects to `/help` while integrations docs remain parked.
- FAQ answers are teasers with `learnMore` links to canonical help/docs URLs.
- Help articles ship TechArticle, BreadcrumbList, and HowTo JSON-LD.
- Unified help + docs search on `/help` and `/docs`.
- Parked MCP help category stays filtered from public exports.
