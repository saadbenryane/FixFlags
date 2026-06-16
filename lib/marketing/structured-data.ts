import { BRAND, SITE_URL } from './copy'

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
  items: ReadonlyArray<{ question: string; answer: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
