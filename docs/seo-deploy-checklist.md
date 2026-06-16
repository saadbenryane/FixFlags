# SEO post-deploy checklist

After deploying to production (`https://fixflags.com`):

1. **Search Console** — Verify domain ownership using `GOOGLE_SITE_VERIFICATION` in Vercel env.
2. **Sitemap** — Submit `https://fixflags.com/sitemap.xml` in Google Search Console.
3. **Request indexing** — Request indexing for `/`, `/pricing`, `/faq`, `/samples`, and `/llms.txt`.
4. **Rich results** — Run [Google Rich Results Test](https://search.google.com/test/rich-results) on `/` (Organization + WebSite + SoftwareApplication) and `/faq` (FAQPage).
5. **Self-audit** — Run a FixFlags audit on `fixflags.com` to confirm canonical, favicon, and schema checks pass.
6. **AI visibility** — Ask ChatGPT or Perplexity "What is FixFlags?" and compare the answer to `lib/marketing/structured-data.ts` and `/llms.txt`.

## Env vars

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Must be `https://fixflags.com` in production (canonicals, sitemap, OG URLs) |
| `GOOGLE_SITE_VERIFICATION` | Search Console meta verification token |

## Local checks

```bash
npm run brand:icons    # regenerate public/favicon.ico and PWA PNGs
npm run seo:guard      # route registry vs copy.ts
npm run verify         # full CI pipeline including build
```
