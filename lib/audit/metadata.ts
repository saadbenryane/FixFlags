import * as cheerio from 'cheerio'
import { safeFetchHtml } from './url'
import { MAX_RAW_TEXT, MAX_STORED_TEXT } from './page-text-limits'

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
  links: Array<{ href: string; text: string; rel: string | null }>
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
  // Unwrap <noscript> content so Cheerio can parse links, headings, and CTAs
  // inside noscript blocks. SPAs often put full fallback content (including
  // navigation links, headings, and contact info) inside noscript for crawlers.
  // Cheerio treats noscript as raw text by default, causing false negatives.
  const unwrapped = html.replace(
    /<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi,
    (_, inner: string) => inner
  )
  const $ = cheerio.load(unwrapped)

  // Extract structured data
  const jsonLd: unknown[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '{}')
      jsonLd.push(parsed)
    } catch {}
  })

  // Images analysis. An image only needs alt text if it is exposed to assistive
  // tech and not already named by ARIA. Skip images hidden (aria-hidden,
  // role=presentation/none) or labeled via aria-label/aria-labelledby, otherwise
  // correctly-marked decorative and ARIA-labeled images produce false positives.
  const images: Array<{ src: string; alt: string | null }> = []
  let imagesWithoutAlt = 0
  $('img').each((_, el) => {
    const $el = $(el)
    const src = $el.attr('src') || ''
    const alt = $el.attr('alt')
    images.push({ src, alt: alt ?? null })
    if (alt !== undefined) return
    const role = ($el.attr('role') || '').toLowerCase()
    const hiddenOrLabeled =
      $el.attr('aria-hidden') === 'true' ||
      role === 'presentation' ||
      role === 'none' ||
      Boolean($el.attr('aria-label')) ||
      Boolean($el.attr('aria-labelledby'))
    if (!hiddenOrLabeled) imagesWithoutAlt++
  })

  // Links analysis
  const links: Array<{ href: string; text: string; rel: string | null }> = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().trim()
    const rel = $(el).attr('rel') || null
    links.push({ href, text, rel })
  })

  // Accessible-name detection shared by links and buttons. An interactive element
  // is "named" if it has visible text, an aria-label/aria-labelledby/title, or a
  // labeled child: img[alt], an svg with <title>/aria-label, or any descendant
  // carrying aria-label/title. Icon-only controls on well-built sites are labeled
  // through these sources, so checking only the element's own text produced large
  // false-positive counts (e.g. 28 "unnamed links" on stripe.com). aria-hidden
  // elements are removed from the accessibility tree and need no name.
  const hasAccessibleName = ($el: ReturnType<typeof $>): boolean => {
    if ($el.attr('aria-hidden') === 'true') return true
    if ($el.text().trim()) return true
    if (($el.attr('aria-label') || '').trim()) return true
    if (($el.attr('aria-labelledby') || '').trim()) return true
    if (($el.attr('title') || '').trim()) return true
    const hasLabeledImg = $el
      .find('img')
      .toArray()
      .some((img) => ($(img).attr('alt') || '').trim() !== '')
    if (hasLabeledImg) return true
    if ($el.find('svg[aria-label], svg > title').length > 0) return true
    const hasLabeledChild = $el
      .find('[aria-label], [title]')
      .toArray()
      .some((c) => (($(c).attr('aria-label') ?? $(c).attr('title')) || '').trim() !== '')
    return hasLabeledChild
  }

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
  const formValidationSelectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="search"]):not([type="email"]):not([type="url"]):not([type="number"]):not([type="tel"]):not([type="date"]):not([type="time"]):not([required]):not([aria-required]), textarea:not([required]):not([aria-required]), select:not([required]):not([aria-required])'
  const formElements = $('form')
  if (formElements.length > 0) {
    formElements.each((_, form) => {
      $(form).find(formInputSelectors).each(() => {
        totalFormInputs++
      })
      $(form).find(formValidationSelectors).each((_, field) => {
        const el = $(field)
        const hasPattern = el.attr('pattern') !== undefined
        const hasMinOrMax = el.attr('min') !== undefined || el.attr('max') !== undefined
        const hasMinOrMaxLength = el.attr('minlength') !== undefined || el.attr('maxlength') !== undefined
        if (!hasPattern && !hasMinOrMax && !hasMinOrMaxLength) formInputsMissingValidation++
      })
    })
  }

  // Buttons without an accessible name
  let buttonsWithoutText = 0
  $('button, [role="button"]').each((_, el) => {
    if (!hasAccessibleName($(el))) buttonsWithoutText++
  })

  // Links without an accessible name
  let linksWithoutText = 0
  $('a').each((_, el) => {
    if (!hasAccessibleName($(el))) linksWithoutText++
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
  const ctaKeywords = ['get started', 'start', 'try', 'sign up', 'signup', 'subscribe', 'buy', 'purchase', 'learn more', 'book', 'schedule', 'contact', 'join', 'download', 'free trial', 'demo', 'explore', 'shop', 'browse', 'watch', 'find', 'claim', 'reserve']
  const ctaTexts: string[] = []
  $('a, button, [role="button"]').each((_, el) => {
    const text = $(el).text().trim().toLowerCase()
    const matchesKeyword = ctaKeywords.some((kw) => {
      if (kw.includes(' ')) return text.includes(kw)
      return new RegExp(`\\b${kw}\\b`).test(text)
    })
    if (matchesKeyword && text.length < 60) {
      ctaTexts.push($(el).text().trim())
    }
  })
  // Also detect search/URL input fields as CTAs (common on tool/SaaS landing pages)
  $('input[type="search"], input[type="url"], input[placeholder*="search" i], input[placeholder*="url" i], input[placeholder*="website" i]').each((_, el) => {
    const placeholder = $(el).attr('placeholder')?.trim()
    if (placeholder) ctaTexts.push(placeholder)
  })

  // Analytics detection
  const htmlStr = html.toLowerCase()
  const hasAnalytics = !!(
    htmlStr.includes('google-analytics') ||
    htmlStr.includes('googletagmanager') ||
    htmlStr.includes('gtag(') ||
    htmlStr.includes('gtag/js') ||
    htmlStr.includes('segment.com') ||
    htmlStr.includes('segment.io') ||
    htmlStr.includes('cdn.segment') ||
    htmlStr.includes('mixpanel') ||
    htmlStr.includes('plausible') ||
    htmlStr.includes('fathom') ||
    htmlStr.includes('amplitude') ||
    htmlStr.includes('hotjar') ||
    htmlStr.includes('hubspot') ||
    htmlStr.includes('fbq(') ||
    htmlStr.includes('snaptr.com') ||
    htmlStr.includes('static.ads-twitter.com') ||
    htmlStr.includes('bat.bing.com') ||
    htmlStr.includes('matomo') ||
    htmlStr.includes('heap-analytics') ||
    htmlStr.includes('fullstory.com') ||
    htmlStr.includes('cdn.heapanalytics.com') ||
    // Commonly-missed modern vendors (these caused false "no analytics" flags on
    // well-instrumented sites like Vercel and PostHog-based apps).
    htmlStr.includes('posthog') ||
    htmlStr.includes('/_vercel/insights') ||
    htmlStr.includes('vercel-scripts.com') ||
    htmlStr.includes('vercel-analytics') ||
    htmlStr.includes('clarity.ms') ||
    htmlStr.includes('cloudflareinsights.com') ||
    htmlStr.includes('static.cloudflareinsights') ||
    htmlStr.includes('pendo') ||
    htmlStr.includes('datadog') ||
    htmlStr.includes('newrelic') ||
    htmlStr.includes('nr-data.net') ||
    htmlStr.includes('june.so') ||
    htmlStr.includes('umami') ||
    htmlStr.includes('rudderstack') ||
    htmlStr.includes('rudderlabs') ||
    htmlStr.includes('statsig') ||
    htmlStr.includes('growthbook')
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
  const pageText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_RAW_TEXT)

  const h1s: string[] = []
  $('h1').each((_, el) => { h1s.push($(el).text().trim()) })

  const h2s: string[] = []
  $('h2').each((_, el) => { h2s.push($(el).text().trim()) })

  const elementIds: string[] = []
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')?.trim().toLowerCase()
    if (id) elementIds.push(id)
  })

  // Resolve og:image and canonical against the page URL. Social crawlers
  // (Slack, Twitter, Facebook) require an absolute og:image, so a relative value
  // like "/og.png" produces a blank preview even though the tag is present.
  const toAbsolute = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim()
    if (!trimmed) return null
    try {
      return new URL(trimmed, url).toString()
    } catch {
      return trimmed
    }
  }

  return {
    title: $('title').first().text().trim() || null,
    description: $('meta[name="description"]').attr('content') || null,
    ogTitle: $('meta[property="og:title"]').attr('content') || null,
    ogDescription: $('meta[property="og:description"]').attr('content') || null,
    ogImage: toAbsolute($('meta[property="og:image"]').attr('content')),
    canonical: toAbsolute($('link[rel="canonical"]').attr('href')),
    lang: $('html').attr('lang') || null,
    viewport: $('meta[name="viewport"]').attr('content') || null,
    robots: $('meta[name="robots"]').attr('content') || null,
    h1s,
    h2s,
    images,
    imagesWithoutAlt,
    links,
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
    pageText: pageText.slice(0, MAX_STORED_TEXT),
  }
}

export async function fetchAndParseMetadataWithHeaders(
  url: string
): Promise<{ metadata: PageMetadata; responseHeaders: Record<string, string> }> {
  const { html, finalUrl, headers } = await safeFetchHtml(url)
  return { metadata: parseMetadataFromHtml(html, finalUrl), responseHeaders: headers }
}

export async function fetchAndParseMetadata(url: string): Promise<PageMetadata> {
  const { metadata } = await fetchAndParseMetadataWithHeaders(url)
  return metadata
}
