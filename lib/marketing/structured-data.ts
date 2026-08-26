import { BRAND, SITE_URL } from './copy'
import type { DocsPageDefinition } from '@/lib/docs/catalog'
import type { HelpArticle, HelpCategory } from '@/lib/help/types'
import { helpArticlePath } from '@/lib/help/types'

const ORG_ID = `${SITE_URL}/#organization`
const WEBSITE_ID = `${SITE_URL}/#website`
const APP_ID = `${SITE_URL}/#software`

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: BRAND.name,
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    description: BRAND.oneLiner,
    email: BRAND.supportEmail,
  }
}

export function webSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: BRAND.name,
    url: SITE_URL,
    publisher: { '@id': ORG_ID },
  }
}

export function softwareApplicationSchema() {
  return {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: BRAND.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description: BRAND.oneLiner,
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  }
}

export function marketingGraphSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationSchema(), webSiteSchema(), softwareApplicationSchema()],
  }
}

export function faqPageSchema(
  items: ReadonlyArray<{ question: string; answer: string; learnMore?: { href: string; label: string } }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.learnMore
          ? `${item.answer} Read more: ${SITE_URL}${item.learnMore.href}`
          : item.answer,
      },
    })),
  }
}

export function docsStructuredData(page: DocsPageDefinition) {
  const url = `${SITE_URL}${page.path}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbListSchema([
        { name: 'Docs', item: `${SITE_URL}/docs` },
        ...(page.path === '/docs' ? [] : [{ name: page.title, item: url }]),
      ]),
      {
        '@type': 'TechArticle',
        headline: page.title,
        description: page.description,
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: SITE_URL },
        publisher: { '@id': ORG_ID },
      },
    ],
  }
}

function breadcrumbListSchema(items: ReadonlyArray<{ name: string; item: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  }
}

export function helpArticleStructuredData(article: HelpArticle, category: HelpCategory) {
  const url = `${SITE_URL}${helpArticlePath(article.categoryId, article.slug)}`
  const graph: Record<string, unknown>[] = [
    breadcrumbListSchema([
      { name: 'Help Center', item: `${SITE_URL}/help` },
      { name: category.title, item: `${SITE_URL}/help/${category.id}` },
      { name: article.title, item: url },
    ]),
    {
      '@type': 'TechArticle',
      headline: article.title,
      description: article.excerpt,
      url,
      ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
      isPartOf: { '@type': 'WebSite', name: BRAND.name, url: SITE_URL },
      publisher: { '@id': ORG_ID },
    },
  ]

  const howTo = howToSchemaFromArticle(article, url)
  if (howTo) graph.push(howTo)

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}

export function helpCategoryStructuredData(category: HelpCategory) {
  const url = `${SITE_URL}/help/${category.id}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbListSchema([
        { name: 'Help Center', item: `${SITE_URL}/help` },
        { name: category.title, item: url },
      ]),
      {
        '@type': 'CollectionPage',
        name: category.title,
        description: category.description,
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: SITE_URL },
      },
    ],
  }
}

function howToSchemaFromArticle(article: HelpArticle, url: string) {
  const stepBlocks = article.body.filter(
    (block): block is { type: 'ol'; items: readonly string[] } | { type: 'steps'; items: readonly string[] } =>
      block.type === 'ol' || block.type === 'steps'
  )
  if (stepBlocks.length === 0) return null

  const steps = stepBlocks.flatMap((block) => block.items)
  if (steps.length === 0) return null

  return {
    '@type': 'HowTo',
    name: article.title,
    description: article.excerpt,
    url,
    step: steps.map((text, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text,
    })),
  }
}

export function issuePageSchema(input: {
  checkId: string
  title: string
  description: string
  rubric: string
  siteCount: number
  occurrenceCount: number
  path: string
}) {
  const url = `${SITE_URL}${input.path}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: input.title,
        description: input.description,
        url,
        about: {
          '@type': 'Thing',
          name: input.checkId,
          description: input.rubric,
        },
        isPartOf: { '@id': WEBSITE_ID },
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'Dataset',
        '@id': `${url}#dataset`,
        name: `${input.title} frequency data`,
        description: `Observed across ${input.siteCount} audited sites (${input.occurrenceCount} occurrences).`,
        url,
        creator: { '@id': ORG_ID },
        measurementTechnique: 'FixFlags automated product audit',
        variableMeasured: [
          {
            '@type': 'PropertyValue',
            name: 'siteCount',
            value: input.siteCount,
          },
          {
            '@type': 'PropertyValue',
            name: 'occurrenceCount',
            value: input.occurrenceCount,
          },
        ],
      },
    ],
  }
}
