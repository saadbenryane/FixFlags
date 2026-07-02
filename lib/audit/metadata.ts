import * as cheerio from 'cheerio'
import { safeFetchHtml } from './url'

export interface PageMetadata {
  title: string | null
  description: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  canonical: string | null
  lang: string | null
  viewport: string | null
  robots: string | null
  h1s: string[]
  h2s: string[]
  images: Array<{ src: string; alt: string | null }>
  imagesWithoutAlt: number
  imagesWithEmptyAlt: number
  links: Array<{ href: string; text: string; rel: string | null }>
  externalLinksWithoutNoopener: number
  forms: number
  inputsWithoutLabel: number
  buttonsWithoutText: number
  linksWithoutText: number
  iframesWithoutTitle: number
  positiveTabindex: number
  ctaTexts: string[]
  hasStructuredData: boolean
  structuredDataTypes: string[]
  hasAnalytics: boolean
  hasCookieConsent: boolean
  hasPrivacyPolicy: boolean
  hasContactInfo: boolean
  hasFavicon: boolean
  hasSkipLink: boolean
  navLandmarkCount: number
  pageText: string
  jsonLd: unknown[]
  /** Lowercase id attributes present on the page (for hash link validation). */
  elementIds: string[]
  /** Count of form input/textarea/select elements lacking validation attributes. */
  formInputsMissingValidation: number
  /** Total number of form input/textarea/select elements. */
  totalFormInputs: number
}

export type RuntimeHeadMetadata = Partial<
  Pick<
    PageMetadata,
    | 'title'
    | 'description'
    | 'ogTitle'
    | 'ogDescription'
    | 'ogImage'
    | 'canonical'
    | 'lang'
    | 'viewport'
    | 'robots'
    | 'hasFavicon'
  >
>

export function mergeRuntimeHeadMetadata(
  metadata: PageMetadata,
  runtime: RuntimeHeadMetadata | null | undefined
): PageMetadata {
  if (!runtime) return metadata

  return {
    ...metadata,
    title: runtime.title?.trim() || metadata.title,
    description: runtime.description?.trim() || metadata.description,
    ogTitle: runtime.ogTitle?.trim() || metadata.ogTitle,
    ogDescription: runtime.ogDescription?.trim() || metadata.ogDescription,
    ogImage: runtime.ogImage?.trim() || metadata.ogImage,
    canonical: runtime.canonical?.trim() || metadata.canonical,
    lang: runtime.lang?.trim() || metadata.lang,
    viewport: runtime.viewport?.trim() || metadata.viewport,
    robots: runtime.robots?.trim() || metadata.robots,
    hasFavicon: metadata.hasFavicon || runtime.hasFavicon === true,
  }
}

export function parseMetadataFromHtml(html: string, url: string): PageMetadata {
  const $ = cheerio.load(html)

  // Extract structured data
  const jsonLd: unknown[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '{}')
      jsonLd.push(parsed)
    } catch {}
  })

  // Images analysis
  const images: Array<{ src: string; alt: string | null }> = []
  let imagesWithoutAlt = 0
  let imagesWithEmptyAlt = 0
  $('img').each((_, el) => {
    const src = $(el).attr('src') || ''
    const alt = $(el).attr('alt')
    images.push({ src, alt: alt ?? null })
    if (alt === undefined) imagesWithoutAlt++
    else if (alt.trim() === '') imagesWithEmptyAlt++
  })

  // Links analysis
  const links: Array<{ href: string; text: string; rel: string | null }> = []
  let externalLinksWithoutNoopener = 0
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().trim()
    const rel = $(el).attr('rel') || null
    links.push({ href, text, rel })
    if (href.startsWith('http') && !href.includes(new URL(url).hostname)) {
      if (!rel?.includes('noopener')) externalLinksWithoutNoopener++
    }
  })

  // Forms and inputs
  let inputsWithoutLabel = 0
  $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select').each((_, el) => {
    const $el = $(el)
    if ($el.attr('aria-hidden') === 'true') return
    const id = $el.attr('id')
    const ariaLabel = $el.attr('aria-label')
    const ariaLabelledby = $el.attr('aria-labelledby')
    if (!ariaLabel && !ariaLabelledby && (!id || !$(`label[for="${id}"]`).length)) {
      if ($el.closest('label').length) return
      inputsWithoutLabel++
    }
  })

  // Form field validation attributes
  let formInputsMissingValidation = 0
  let totalFormInputs = 0
  const formInputSelectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="search"]), textarea, select'
  const formValidationSelectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="search"]):not([required]):not([aria-required]), textarea:not([required]):not([aria-required]), select:not([required]):not([aria-required])'
  const formElements = $('form')
  if (formElements.length > 0) {
    formElements.each((_, form) => {
      $(form).find(formInputSelectors).each(() => {
        totalFormInputs++
      })
      $(form).find(formValidationSelectors).each((_, field) => {
        const el = $(field)
        const hasPattern = el.attr('pattern') !== undefined
        if (!hasPattern) formInputsMissingValidation++
      })
    })
  }

  // Buttons without text
  let buttonsWithoutText = 0
  $('button, [role="button"]').each((_, el) => {
    const text = $(el).text().trim()
    const ariaLabel = $(el).attr('aria-label')
    if (!text && !ariaLabel) buttonsWithoutText++
  })

  // Links without text
  let linksWithoutText = 0
  $('a').each((_, el) => {
    const text = $(el).text().trim()
    const ariaLabel = $(el).attr('aria-label')
    const title = $(el).attr('title')
    if (!text && !ariaLabel && !title) linksWithoutText++
  })

  // iframes without title
  let iframesWithoutTitle = 0
  $('iframe').each((_, el) => {
    if (!$(el).attr('title')) iframesWithoutTitle++
  })

  // Positive tabindex
  let positiveTabindex = 0
  $('[tabindex]').each((_, el) => {
    const val = parseInt($(el).attr('tabindex') || '0', 10)
    if (val > 0) positiveTabindex++
  })

  // CTA detection
  const ctaKeywords = ['get started', 'start', 'try', 'sign up', 'signup', 'subscribe', 'buy', 'purchase', 'learn more', 'book', 'schedule', 'contact', 'join', 'download', 'free trial', 'demo']
  const ctaTexts: string[] = []
  $('a, button, [role="button"]').each((_, el) => {
    const text = $(el).text().trim().toLowerCase()
    if (ctaKeywords.some((kw) => text.includes(kw)) && text.length < 60) {
      ctaTexts.push($(el).text().trim())
    }
  })

  // Analytics detection
  const htmlStr = html.toLowerCase()
  const hasAnalytics = !!(
    htmlStr.includes('google-analytics') ||
    htmlStr.includes('googletagmanager') ||
    htmlStr.includes('gtag(') ||
    htmlStr.includes('segment.com') ||
    htmlStr.includes('mixpanel') ||
    htmlStr.includes('plausible') ||
    htmlStr.includes('fathom')
  )

  // Cookie consent
  const hasCookieConsent = !!(
    htmlStr.includes('cookie') &&
    (htmlStr.includes('cookiebot') ||
      htmlStr.includes('cookieconsent') ||
      htmlStr.includes('onetrust') ||
      htmlStr.includes('cookie banner') ||
      $('[id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"]').length > 0)
  )

  // Privacy policy detection
  const hasPrivacyPolicy = !!(
    $('a').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      const href = ($(el).attr('href') || '').toLowerCase()
      return text.includes('privacy') || href.includes('privacy')
    }).length > 0
  )

  // Contact info detection
  const hasContactInfo = !!(
    htmlStr.includes('contact') ||
    htmlStr.includes('@') ||
    htmlStr.match(/\d{3}[-.\s]\d{3}[-.\s]\d{4}/)
  )

  const hasFavicon = $(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  ).length > 0

  const navLandmarkCount = $('nav, [role="navigation"]').length

  let hasSkipLink = false
  $('a[href^="#"]').each((_, el) => {
    const text = $(el).text().toLowerCase()
    const cls = ($(el).attr('class') || '').toLowerCase()
    const id = ($(el).attr('id') || '').toLowerCase()
    if (text.includes('skip') || cls.includes('skip') || id.includes('skip')) {
      hasSkipLink = true
    }
  })

  // Page text (stripped)
  $('script, style, noscript').remove()
  const pageText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000)

  const h1s: string[] = []
  $('h1').each((_, el) => { h1s.push($(el).text().trim()) })

  const h2s: string[] = []
  $('h2').each((_, el) => { h2s.push($(el).text().trim()) })

  const elementIds: string[] = []
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')?.trim().toLowerCase()
    if (id) elementIds.push(id)
  })

  return {
    title: $('title').first().text().trim() || null,
    description: $('meta[name="description"]').attr('content') || null,
    ogTitle: $('meta[property="og:title"]').attr('content') || null,
    ogDescription: $('meta[property="og:description"]').attr('content') || null,
    ogImage: $('meta[property="og:image"]').attr('content') || null,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    lang: $('html').attr('lang') || null,
    viewport: $('meta[name="viewport"]').attr('content') || null,
    robots: $('meta[name="robots"]').attr('content') || null,
    h1s,
    h2s,
    images,
    imagesWithoutAlt,
    imagesWithEmptyAlt,
    links,
    externalLinksWithoutNoopener,
    forms: $('form').length,
    inputsWithoutLabel,
    buttonsWithoutText,
    linksWithoutText,
    iframesWithoutTitle,
    positiveTabindex,
    ctaTexts: [...new Set(ctaTexts)].slice(0, 10),
    hasStructuredData: jsonLd.length > 0,
    structuredDataTypes: jsonLd
      .map((d: unknown) => (d as Record<string, unknown>)['@type'] as string)
      .filter(Boolean),
    hasAnalytics,
    hasCookieConsent,
    hasPrivacyPolicy,
    hasContactInfo,
    hasFavicon,
    hasSkipLink,
    navLandmarkCount,
    pageText,
    jsonLd,
    elementIds,
    formInputsMissingValidation,
    totalFormInputs,
  }
}

/** Persist only summary fields, large arrays are only needed during checks. */
export function trimMetadataForStorage(metadata: PageMetadata) {
  const { images, links, jsonLd, pageText, h2s, ...compact } = metadata
  void images; void links; void jsonLd
  return {
    ...compact,
    h2s: h2s.slice(0, 10),
    pageText: pageText.slice(0, 500),
  }
}

export async function fetchAndParseMetadata(url: string): Promise<PageMetadata> {
  const { html, finalUrl } = await safeFetchHtml(url)
  return parseMetadataFromHtml(html, finalUrl)
}
