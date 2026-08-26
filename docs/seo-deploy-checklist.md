# SEO post-deploy checklist

*Last updated: 2026-08-27*

After deploying to production (`https://fixflags.com`):

1. **Search Console** — Verify domain ownership using `GOOGLE_SITE_VERIFICATION` in Vercel env.
2. **Sitemap** — Submit `https://fixflags.com/sitemap.xml` in Google Search Console.
3. **Request indexing** — Request indexing for `/`, `/pricing`, `/faq`, `/help`, `/docs`, `/samples`, and `/llms.txt`.
4. **Rich Results Test** — Run [Google Rich Results Test](https://search.google.com/test/rich-results) on:
   - `/` — Organization + WebSite + SoftwareApplication
   - `/faq` — FAQPage
   - `/help/billing-and-plans/payment-past-due` — TechArticle + BreadcrumbList (+ HowTo if steps)
   - `/docs/troubleshooting` — TechArticle + BreadcrumbList
   - `/blog/why-ai-built-sites-need-a-launch-check` — BlogPosting
   - `/issues` — CollectionPage + ItemList (when issues exist)
   - One `/issues/[checkId]` URL — Article + Dataset + BreadcrumbList
   - One public `/report/[id]` — WebPage (completed public or anonymous report)
5. **View-source spot check** — Confirm canonical, OG, and JSON-LD on `/partners`, `/tools/meta-preview`, and `/tools/placeholder-detector`.
6. **Self-audit** — Run a FixFlags product review on `fixflags.com` to confirm canonical, favicon, and schema checks pass.
7. **AI visibility** — Ask ChatGPT or Perplexity "What is FixFlags?" and compare the answer to `lib/marketing/structured-data.ts` and `/llms.txt`.

## Env vars

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Must be `https://fixflags.com` in production (canonicals, sitemap, OG URLs) |
| `GOOGLE_SITE_VERIFICATION` | Search Console meta verification token |

## Local checks

```bash
npm run seo:guard
npm run metadata:route-guard
npm run brand:icons    # regenerate public/favicon.ico and PWA PNGs
npm run validate:affected
```

Full architecture reference: [`docs/seo.md`](./seo.md).
