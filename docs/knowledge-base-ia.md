# Knowledge base information architecture

FixFlags ships three public knowledge surfaces. Each has a distinct job; overlap is resolved by canonical ownership and cross-links.

## Surfaces

| Surface | Route | Audience | Job |
|---------|-------|----------|-----|
| Documentation | `/docs` | New and returning builders | Learn how the product works: loop, reports, troubleshooting |
| Help Center | `/help` | Signed-in users who are stuck | Billing, account, failed checks, privacy, human support |
| FAQ | `/faq` | Pre-purchase visitors | Short answers for SEO and pricing-page questions |

## Canonical ownership

| Topic | Canonical home | Others |
|-------|----------------|--------|
| Product loop, report structure, fix prompts | `/docs` | Help excerpts link here |
| Scores, severity, rubrics | `/help/checks-and-reports/scores-and-severity` | FAQ links here; `/docs/reports` for workflow depth |
| Billing, credits, cancel, invoices | `/help/billing-and-plans/*` | FAQ: teaser + link |
| Failed checks, URL reachability, stuck reviews | `/help/checks-and-reports/*` | `/docs/troubleshooting` links here |
| Account, privacy, contact | `/help/account/*` | — |
| Pre-purchase positioning | `/faq` | Links to docs and help for depth |

## Maintenance

- Help article bodies: `lib/help/catalog.ts`
- Help chrome and SLA: `lib/marketing/copy/brand.ts`, `lib/help/sla.ts`
- Docs pages: `content/docs/*.md` + `lib/docs/catalog.ts`
- FAQ: `lib/marketing/copy/faq.ts` (teasers + `learnMore` links to canonical URLs)
- Contextual in-product links: `lib/help/contextual.ts`
- Unified search index: `lib/knowledge/search.ts`
- Structured data: `lib/marketing/structured-data.ts`

## Rules

1. One canonical fact per topic. FAQ never duplicates a full help article without a `learnMore` link.
2. New stuck surfaces in the app must link to help and offer chat (`HelpSupportActions`).
3. Parked power-tool docs (MCP, CLI, integrations) stay out of public nav until un-parked.
4. Do not merge Docs into Help. Stripe, Linear, and Notion keep the same split.
