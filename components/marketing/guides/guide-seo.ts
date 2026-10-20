import { buildIndexableMetadata } from '@/lib/marketing/metadata'
import { BRAND, SITE_URL } from '@/lib/marketing/copy/brand'
import { GUIDE_REVIEWED_AT, GUIDES_PAGE, type WebsiteGuide } from '@/lib/marketing/copy/guides'

export function guideMetadata(guide: WebsiteGuide) {
  return buildIndexableMetadata({
    title: `${guide.title} | ${BRAND.name}`,
    description: guide.description,
    path: `/guides/${guide.slug}`,
    openGraphType: 'article',
    publishedTime: GUIDE_REVIEWED_AT,
    modifiedTime: GUIDE_REVIEWED_AT,
  })
}

export function guideSchema(guide: WebsiteGuide) {
  const url = `${SITE_URL}/guides/${guide.slug}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: guide.title,
        description: guide.description,
        mainEntityOfPage: url,
        datePublished: GUIDE_REVIEWED_AT,
        dateModified: GUIDE_REVIEWED_AT,
        author: { '@type': 'Organization', name: BRAND.name, url: SITE_URL },
        publisher: { '@type': 'Organization', name: BRAND.name, url: SITE_URL },
        citation: guide.sources.map(source => source.href.startsWith('/') ? `${SITE_URL}${source.href}` : source.href),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: GUIDES_PAGE.eyebrow, item: `${SITE_URL}/guides` },
          { '@type': 'ListItem', position: 2, name: guide.title, item: url },
        ],
      },
    ],
  }
}
