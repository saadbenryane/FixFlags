---
status: supporting
authority: interface
reviewed_at: 2026-10-11
supersedes: []
---

# Knowledge base information architecture

FixFlags ships three public knowledge surfaces. Each has a distinct job; overlap is resolved by canonical ownership and cross-links. Customer product objects follow [product-architecture.md](product-architecture.md). Public docs describe current Site behavior and available connections. Plans are not evidence that a capability is available.

## Surfaces

| Surface | Route | Audience | Job |
|---------|-------|----------|-----|
| Documentation | `/docs` | New and returning builders | Learn the Site, Flags, Verify, Watch, and integration workflows |
| Help Center | `/help` | Signed-in users who are stuck | Billing, account, failed checks, privacy, human support |
| FAQ | `/faq` | Pre-purchase visitors | Short answers for SEO and pricing-page questions |

## Canonical ownership

| Topic | Canonical home | Others |
|-------|----------------|--------|
| Product loop, Site coverage, Flags, verification | `/docs` | Help excerpts link here |
| Integration setup, permissions, coverage, removal | `/docs/integrations/*` | `/integrations` introduces providers; Help links to canonical guides |
| Flag severity and evidence | `/help/flags-fix-verify/*`, `/help/sites-and-coverage/*` | `/docs/site-care` explains the workflow |
| Billing, plans, cancel, invoices | `/help/account-and-billing/*` | FAQ: teaser + link |
| Failed checks, URL reachability | `/help/troubleshooting/*` | `/docs/troubleshooting` links here |
| Account, privacy, contact | `/help/account-and-billing/*`, `/help/privacy-and-security/*`, `/help/troubleshooting/contact-support` | Docs link to Help for recovery |
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
3. Shopify, Google Analytics, and Search Console guides are published under Integrations. Parked power-tool docs (MCP and CLI) remain gated until their release evidence exists.
4. Do not merge Docs into Help. Stripe, Linear, and Notion keep the same split.
