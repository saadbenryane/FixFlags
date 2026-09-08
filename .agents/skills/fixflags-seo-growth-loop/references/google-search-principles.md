# Google search principles

Use this reference before changing indexable content, metadata, crawl controls, canonicals, or structured data. Recheck the linked first-party documentation when a decision depends on current Google behavior.

## People-first value

Google's systems aim to reward helpful, reliable content made for people.

Require:

- an intended FixFlags audience and task
- original information, analysis, evidence, or utility
- a satisfying answer that does not force another search
- accurate authorship, sourcing, and production context where expected
- a clear reason to exist beyond attracting search traffic

Reject:

- broad automated publishing across unrelated topics
- summaries that add no substantial value
- arbitrary word counts
- changed dates without substantial updates
- pages made primarily to manipulate rankings

Source: [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

## Titles and result clarity

- Give every indexable page a descriptive, concise, distinct title.
- Keep the visible main heading and title aligned.
- Use the brand concisely rather than repeating boilerplate.
- Avoid vague labels, repetition, and keyword stuffing.
- Treat a title as a preference signal. Google may generate another title from headings, visible text, anchors, `og:title`, or `WebSite` structured data.
- Measure CTR only after confirming that Google recrawled the page and enough impressions accumulated.

Source: [Influencing title links](https://developers.google.com/search/docs/appearance/title-link)

## Crawl, index, and canonical

- A robots disallow controls crawling, not guaranteed de-indexing. Use `noindex` on a crawlable page when removal from search is intended.
- Canonical annotations, redirects, HTTPS, internal links, and sitemap entries should agree.
- A canonical is a hint. Record Google's selected canonical separately from the declared canonical.
- Include only useful canonical URLs in sitemaps.
- Do not infer indexability from an HTTP 200 response alone.

Sources:

- [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization)

## Search Console measurement

Search Analytics reports clicks, impressions, CTR, and average position over a selected date range.

Interpretation rules:

- compare matching date lengths, countries, devices, search types, and page/query filters
- label the property's time-zone and freshness limitations when relevant
- do not average row CTRs or positions without weighting; use aggregate clicks/impressions and impression-weighted position
- keep query and page dimensions together when diagnosing cannibalization
- paginate where completeness matters, while acknowledging that the API may still expose only top rows
- separate finalized data from partial recent data

Source: [Search Analytics query API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)

## Spam safety

Before shipping a creative SEO tactic, check it against current [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies).

Stop when the tactic depends on:

- cloaking or sneaky redirects
- doorway pages
- expired-domain abuse
- hacked, scraped, or automatically transformed content without value
- scaled content abuse
- hidden text or links
- link schemes or site-reputation abuse

The test is not whether automation was used. The test is whether the result exists primarily to manipulate rankings and lacks value for people.

## Structured data

Add structured data only when:

- the visible page genuinely contains the represented information
- the type is supported for the intended search feature
- required properties come from current, attributable data
- the markup remains synchronized with visible content

Passing schema validation does not guarantee a rich result.
