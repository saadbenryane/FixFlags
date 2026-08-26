# SEO architecture

Canonical reference for FixFlags search and structured-data setup.

## Registry

All indexable marketing routes live in one registry:

- [`lib/marketing/seo-routes.ts`](../lib/marketing/seo-routes.ts) — `INDEXABLE_ROUTES`, `LLMS_SECTIONS`
- [`lib/marketing/copy/seo.ts`](../lib/marketing/copy/seo.ts) — title and description copy per route

The registry drives:

- [`app/sitemap.ts`](../app/sitemap.ts) — static routes + help articles + blog + graph-driven issue pages
- [`app/llms.txt/route.ts`](../app/llms.txt/route.ts) — AI crawler discovery
- [`scripts/seo-guard.mjs`](../scripts/seo-guard.mjs) — registry ↔ copy ↔ llms.txt sync
- [`scripts/metadata-route-guard.mjs`](../scripts/metadata-route-guard.mjs) — every indexable route uses an approved metadata helper

## Metadata helpers

| Helper | Use for |
|--------|---------|
| `buildPageMetadata(seoKey, path)` | Static marketing pages in `INDEXABLE_ROUTES` |
| `buildIndexableMetadata({ title, description, path, ... })` | Custom indexable pages (roast, dynamic titles) |
| `buildDocsMetadata(page)` | Docs pages |
| `buildHelpArticleMetadata` / `buildHelpCategoryMetadata` | Help articles and categories |
| `buildBlogPostMetadata(post)` | Blog posts |
| `buildIssuePageMetadata(input)` | Flag Library issue detail |

All helpers live in or delegate to [`lib/marketing/metadata.ts`](../lib/marketing/metadata.ts) and set canonical URL, `robots: index`, Open Graph image, and Twitter large card.

### Indexation policy

| Surface | Index? |
|---------|--------|
| Marketing, docs, help, FAQ, blog, tools, issues | Yes |
| Completed public or anonymous reports | Yes (`robots: index`) |
| In-progress, private, or owner-only reports | No |
| App shell (`/dashboard`, `/settings`, …) | No |
| Share tokens (`/share/[token]`) | No |
| Waitlist plan variants (`/waitlist/pro`, …) | No (canonical `/waitlist`) |

## Structured data (schema.org)

Central module: [`lib/marketing/structured-data.ts`](../lib/marketing/structured-data.ts)

| Export | Schema types | Surfaces |
|--------|-------------|----------|
| `marketingGraphSchema()` | Organization, WebSite, SoftwareApplication | Marketing + docs layouts |
| `faqPageSchema()` | FAQPage | `/faq` |
| `docsStructuredData()` | BreadcrumbList, TechArticle | Docs pages |
| `helpHubStructuredData()` | CollectionPage, ItemList | `/help` |
| `helpArticleStructuredData()` | BreadcrumbList, TechArticle, optional HowTo | Help articles |
| `helpCategoryStructuredData()` | BreadcrumbList, CollectionPage | Help categories |
| `issueIndexStructuredData()` | CollectionPage, ItemList | `/issues` |
| `issuePageSchema()` | BreadcrumbList, Article, Dataset | `/issues/[checkId]` |
| `blogPostingSchema()` | BreadcrumbList, BlogPosting | `/blog/[slug]` |
| `toolPageStructuredData()` | BreadcrumbList, WebApplication | `/tools/*` |
| `publicReportStructuredData()` | WebPage | Public `/report/[id]` |

Marketing and docs layouts inject the base graph on every page. Page-specific schemas add breadcrumbs and content types without duplicating Organization data on the same node.

## Robots and crawlers

[`app/robots.ts`](../app/robots.ts) disallows private prefixes (`/admin`, `/api`, `/dashboard`, auth routes, …) for all crawlers including named AI bots.

## Local verification

```bash
npm run seo:guard
npm run metadata:route-guard
npx vitest run lib/marketing/__tests__/metadata.test.ts lib/marketing/__tests__/structured-data.test.ts
npm run validate:affected
```

Post-deploy checklist: [`seo-deploy-checklist.md`](./seo-deploy-checklist.md).

## Environment

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Canonical base (`https://fixflags.com` in production) |
| `GOOGLE_SITE_VERIFICATION` | Search Console meta tag |

Root layout sets `metadataBase` from `SITE_URL` so relative OG paths resolve correctly.
