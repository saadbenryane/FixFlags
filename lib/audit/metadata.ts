import { CONSENT_CONTEXT_SELECTOR, isConsentControl } from './consent-controls'
import { analyticsMarkupSignals } from './metadata-markup-signals'
import * as cheerio from 'cheerio'
import { safeFetchHtml } from './url'
import { MAX_RAW_TEXT, MAX_STORED_TEXT } from './page-text-limits'
import { normalizeHeadingText } from './checks/utils'
import { collectResourceTransport, type ResourceTransport } from './resource-transport'
import { htmlDocumentBase, htmlDocumentIds, isInertHtmlNode } from './html-document'
import { collectFormInventory } from './metadata-form-inventory'

export interface PageMetadata {
  renderedCopy?: import('./browser/rendered-copy').RenderedCopy | null
  /** Visible introductory prose following the primary headline, before another heading. */
  headlineSupport?: string | null
  /** Published quotation blocks, with attribution from the same figure when present. */
  testimonialBlocks?: Array<{ quote: string; attribution: string | null }>
  /** Observed document base used to resolve relative navigation declarations. */
  linkBaseUrl?: string
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
  resourceTransport?: ResourceTransport
  imagesWithoutAlt: number
  links: Array<{ href: string; text: string; rel: string | null }>
  /** Scripting-enabled document links, excluding template and noscript descendants. */
  documentLinks?: Array<{ href: string; text: string }>
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
  /** True when analytics providers that use cookies are detected. Excludes
   *  cookie-less providers (Cloudflare Web Analytics, Plausible, Fathom, etc.)
   *  so the cookie-consent-absent check does not fire on privacy-friendly analytics. */
  hasCookieBasedAnalytics: boolean
  hasCookieConsent: boolean
  hasPrivacyPolicy: boolean
  hasContactInfo: boolean
  hasFavicon: boolean
  hasSkipLink: boolean
  navLandmarkCount: number
  pageText: string
  jsonLd: unknown[]
  /** Exact id attributes. Fragment targets are case sensitive. */
  elementIds: string[]
  /** Named anchors from the same complete HTML. Absent in older snapshots,
   * whose normalized identifiers cannot establish exact fragment recovery. */
  anchorNames?: string[]
  /** Count of form input/textarea/select elements lacking validation attributes. */
  formInputsMissingValidation: number
  /** Total number of form input/textarea/select elements. */
  totalFormInputs: number
  /** Largest number of input fields in any single form that contains a
   *  conversion CTA (sign up, start free, etc.). Excludes search, login, and
   *  utility forms so the friction check only fires on real conversion flows. */
  maxConversionFormInputs: number
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

function absoluteMetadataUrl(value: string | null | undefined, base?: string): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try { return new URL(trimmed, base).href }
  catch { return trimmed }
}

export function mergeRuntimeHeadMetadata(
  metadata: PageMetadata,
  runtime: RuntimeHeadMetadata | null | undefined,
  renderedCopy?: import('./browser/rendered-copy').RenderedCopy | null,
): PageMetadata {
  const observed = renderedCopy === undefined ? metadata : { ...metadata, renderedCopy }
  if (!runtime) return observed

  const merged = { ...observed }
  for (const field of ['title', 'description', 'ogTitle', 'ogDescription', 'ogImage', 'canonical', 'lang', 'viewport', 'robots'] as const) {
    const value = runtime[field]
    // Undefined is unavailable. Null is a native observation of absence.
    if (value !== undefined) merged[field] = field === 'ogImage' || field === 'canonical'
      ? absoluteMetadataUrl(value, metadata.linkBaseUrl) : value?.trim() || null
  }
  if (runtime.hasFavicon !== undefined) merged.hasFavicon = runtime.hasFavicon
  return merged
}

export type MetadataMode = 'crawler' | 'rendered'

/** Published privacy and contact signals. Hidden, script, style and template
 * text is already removed from the contact inputs. */
export function publishedTrustSignals(input: {
  anchors: ReadonlyArray<{ text: string; href: string }>
  publishedText: string
  publishedHrefs: readonly string[]
  jsonLd: readonly unknown[]
}) {
  const hasPrivacyPolicy = input.anchors.some(anchor => {
    const text = anchor.text.toLowerCase()
    const href = anchor.href.toLowerCase()
    return text.includes('privacy') || href.includes('privacy')
  })
  const publishedText = input.publishedText.toLowerCase()
  const publishedHrefs = input.publishedHrefs.map(href => href.toLowerCase())
  const hasContactInfoFromText = publishedText.includes('contact') || publishedText.includes('@') ||
    publishedText.search(/\d{3}[-.\s]\d{3}[-.\s]\d{4}/) !== -1 ||
    publishedHrefs.some(href => href.includes('contact') || href.startsWith('mailto:') || href.startsWith('tel:'))
  const hasContactInfoFromJsonLd = input.jsonLd.some(item => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    if (record.email || record.contactPoint) return true
    const text = JSON.stringify(record).toLowerCase()
    return text.includes('"email"') || text.includes('contactpoint')
  })
  return { hasPrivacyPolicy, hasContactInfo: hasContactInfoFromText || hasContactInfoFromJsonLd }
}

export function parseMetadataFromHtml(html: string, url: string, mode: MetadataMode = 'crawler'): PageMetadata {
  // Resource declarations use the scripting-enabled parse, so fallback and
  // template contents cannot become claims about live resource requests.
  const document = cheerio.load(html)
  const resourceTransport = collectResourceTransport(document, url)
  const linkBaseUrl = htmlDocumentBase(document, url)
  // HTTP metadata retains crawler fallbacks. Browser metadata describes the
  // scripting-enabled document, where these descendants are inactive.
  const $ = mode === 'rendered' ? document : cheerio.load(html.replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, (_, inner: string) => inner))
  if (mode === 'rendered') $('noscript,template').empty()
  const documentIds = htmlDocumentIds($)

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
  const isInHiddenSubtree = ($el: ReturnType<typeof $>): boolean => {
    if ($el.is('[hidden]') || $el.attr('aria-hidden') === 'true') return true
    return $el.parents('[hidden], [aria-hidden="true"]').length > 0
  }

  const SR_ONLY_CLASS = /\b(sr-only|visually-hidden|screen-reader-only|skip-nav|skip-link)\b/i

  const hasAccessibleName = ($el: ReturnType<typeof $>): boolean => {
    if ($el.attr('aria-hidden') === 'true') return true
    if ($el.text().trim()) return true
    const srOnlyText = $el
      .find('[class]')
      .toArray()
      .filter((child) => SR_ONLY_CLASS.test($(child).attr('class') || ''))
      .map((child) => $(child).text().trim())
      .find(Boolean)
    if (srOnlyText) return true
    if (($el.attr('aria-label') || '').trim()) return true
    const labelledBy = ($el.attr('aria-labelledby') || '').trim()
    if (labelledBy) {
      const labelText = labelledBy
        .split(/\s+/)
        .map(id => { const label = documentIds.get(id); return label ? $(label).text().trim() : '' })
        .filter(Boolean)
        .join(' ')
      if (labelText) return true
    }
    if (($el.attr('title') || '').trim()) return true
    const hasLabeledImg = $el
      .find('img')
      .toArray()
      .some((img) => ($(img).attr('alt') || '').trim() !== '')
    if (hasLabeledImg) return true
    if ($el.find('svg[aria-label], svg > title').length > 0) return true
    if ($el.is('a')) {
      const cls = ($el.attr('class') || '').toLowerCase()
      if (/\babsolute\b/.test(cls) && /\binset-0\b/.test(cls)) {
        const container = $el.closest('article, li, section, [class*="card"]')
        const heading = container.find('h2, h3, h4').first().text().trim()
        if (heading.length >= 4) return true
      }
    }
    const hasLabeledChild = $el
      .find('[aria-label], [title]')
      .toArray()
      .some((c) => (($(c).attr('aria-label') ?? $(c).attr('title')) || '').trim() !== '')
    return hasLabeledChild
  }

  const shouldCountInteractive = ($el: ReturnType<typeof $>): boolean => {
    if (isInHiddenSubtree($el)) return false
    if ($el.closest('template').length > 0) return false
    return true
  }

  // Forms and inputs
  // Note: <input type="file"> is excluded because it is always visually hidden
  // and triggered by an adjacent button that carries the accessible name.
  let inputsWithoutLabel = 0
  const explicitLabels = new Set($('label[for]').toArray().filter(label => !isInertHtmlNode(label)).map(label => $(label).attr('for')!))
  $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]), textarea, select').each((_, el) => {
    const $el = $(el)
    if ($el.attr('aria-hidden') === 'true') return
    const id = $el.attr('id')
    const ariaLabel = $el.attr('aria-label')
    const ariaLabelledby = $el.attr('aria-labelledby')
    const hasExplicitLabel = Boolean(id && explicitLabels.has(id) && documentIds.get(id) === el)
    if (!ariaLabel && !ariaLabelledby && !hasExplicitLabel) {
      if ($el.closest('label').length) return
      inputsWithoutLabel++
    }
  })

  const formInventory = collectFormInventory($, documentIds)

  // Buttons without an accessible name
  let buttonsWithoutText = 0
  $('button, [role="button"]').each((_, el) => {
    const $el = $(el)
    if (!shouldCountInteractive($el)) return
    if (!hasAccessibleName($el)) buttonsWithoutText++
  })

  // Links without an accessible name
  let linksWithoutText = 0
  $('a').each((_, el) => {
    const $el = $(el)
    if (!shouldCountInteractive($el)) return
    if (!hasAccessibleName($el)) linksWithoutText++
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

  const htmlStr = html.toLowerCase()
  const { hasAnalytics, hasCookieBasedAnalytics } = analyticsMarkupSignals(htmlStr)

  // Consent evidence must describe a published surface or control, not a
  // mention inside implementation code, examples, or inactive markup.
  const publishedBody = document('body').clone()
  publishedBody.find('script,style,template,noscript,pre,code,kbd,samp,[hidden],[inert],[aria-hidden="true"]').remove()
  const hasCookieConsent = publishedBody.find('button,a[href],[role="button"],input[type="button"],input[type="submit"]').toArray().some(element => {
    const control = document(element)
    const name = [control.attr('aria-label'), control.attr('title'), control.text(), control.attr('value')].filter(Boolean).join(' ').replace(/\s+/g, ' ')
    const surface = control.closest(CONSENT_CONTEXT_SELECTOR)
    const context = [surface.attr('aria-label'), surface.text()].filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 2000)
    return isConsentControl({ name, context })
  }) || publishedBody.find('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i]').toArray().some(element => {
    // A declared consent surface is evidence of presence, not enforcement.
    const text = document(element).text().replace(/\s+/g, ' ')
    return /\bcookies?\b/i.test(text) && /\b(settings|preferences|consent|accept|reject|allow|decline)\b/i.test(text)
  })
  const testimonialBlocks = publishedBody.find('blockquote,[itemprop="review"]').toArray().slice(0, 1000).map(element => {
    const block = document(element)
    const figure = block.closest('figure')
    const parent = block.parent()
    const citation = block.find('cite').first()
    const siblingCaption = !parent.is('body,main,article,[role="main"]') ? block.next('footer') : null
    // Only the same figure or immediate quotation container can supply attribution.
    const attribution = citation.length ? citation.text()
      : figure.length && figure.find('blockquote,[itemprop="review"]').length === 1 ? figure.find('figcaption').first().text()
        : siblingCaption?.length ? siblingCaption.text() : ''
    const quotation = block.clone()
    quotation.find('cite,figcaption,footer').remove()
    return { quote: quotation.text().replace(/\s+/g, ' ').trim().slice(0, MAX_RAW_TEXT),
      attribution: attribution.replace(/\s+/g, ' ').trim().slice(0, 1200) || null }
  }).filter(block => block.quote)

  // Privacy and contact use one predicate. Rendered destination probes call it
  // with the live document when the saved HTML no longer fits.
  const contactBody = $('body').clone()
  contactBody.find('script,style,template,[hidden]').remove()
  const { hasPrivacyPolicy, hasContactInfo } = publishedTrustSignals({
    anchors: $('a').toArray().map(element => ({ text: $(element).text(), href: $(element).attr('href') || '' })),
    publishedText: contactBody.text(),
    publishedHrefs: contactBody.find('a[href]').toArray().map(element => $(element).attr('href') ?? ''),
    jsonLd,
  })

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

  // Page text (stripped). Remove code samples (pre/code/kbd/samp) too: displayed
  // code legitimately contains template tokens (${company}, {{var}}), TODO
  // markers, and non-prose runs, which otherwise produce false positives in the
  // placeholder, template-token, and sentence-quality checks. Code is never
  // marketing prose, so excluding it makes copy analysis accurate on dev-tool
  // and API sites (Resend, Stripe, etc.) that show code on the page.
  $('script, style, noscript, pre, code, kbd, samp').remove()
  const pageText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_RAW_TEXT)

  const h1s: string[] = []
  $('h1').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (!text) return
    const normalized = normalizeHeadingText(text)
    // Responsive layouts often duplicate the same H1 for mobile/desktop.
    if (!h1s.some((existing) => existing === normalized || existing.includes(normalized) || normalized.includes(existing))) {
      h1s.push(normalized)
    }
  })

  const h2s: string[] = []
  $('h2').each((_, el) => { h2s.push($(el).text().trim()) })

  const elementIds: string[] = []
  document('[id]').each((_, el) => {
    if (isInertHtmlNode(el)) return
    const id = document(el).attr('id')
    if (id) elementIds.push(id)
  })
  const anchorNames: string[] = []
  document('a[name]').each((_, el) => {
    if (isInertHtmlNode(el)) return
    const name = document(el).attr('name')
    if (name) anchorNames.push(name)
  })
  const documentLinks: NonNullable<PageMetadata['documentLinks']> = []
  document('a[href]').each((_, el) => {
    if (isInertHtmlNode(el)) return
    documentLinks.push({ href: document(el).attr('href') ?? '', text: document(el).text().trim() })
  })

  return {
    linkBaseUrl,
    title: $('title').first().text().trim() || null,
    description: $('meta[name="description"]').attr('content') || null,
    ogTitle: $('meta[property="og:title"]').attr('content') || null,
    ogDescription: $('meta[property="og:description"]').attr('content') || null,
    ogImage: absoluteMetadataUrl($('meta[property="og:image"]').attr('content'), linkBaseUrl),
    canonical: absoluteMetadataUrl($('link[rel="canonical"]').attr('href'), linkBaseUrl),
    lang: $('html').attr('lang') || null,
    viewport: $('meta[name="viewport"]').attr('content') || null,
    robots: $('meta[name="robots"]').attr('content') || null,
    h1s,
    h2s,
    images,
    resourceTransport,
    imagesWithoutAlt,
    links,
    documentLinks,
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
    hasCookieBasedAnalytics,
    hasCookieConsent,
    testimonialBlocks,
    hasPrivacyPolicy,
    hasContactInfo,
    hasFavicon,
    hasSkipLink,
    navLandmarkCount,
    pageText,
    jsonLd,
    elementIds,
    anchorNames,
    ...formInventory,
  }
}

/** Persist only summary fields, large arrays are only needed during checks. */
export function trimMetadataForStorage(metadata: PageMetadata) {
  const { images, links, documentLinks, jsonLd, pageText, h2s, ...compact } = metadata
  void images; void links; void documentLinks; void jsonLd
  return {
    ...compact,
    ...(metadata.renderedCopy ? { renderedCopy: { ...metadata.renderedCopy, pageText: metadata.renderedCopy.pageText.slice(0, MAX_STORED_TEXT),
      textTruncated: metadata.renderedCopy.textTruncated || metadata.renderedCopy.pageText.length > MAX_STORED_TEXT } } : {}),
    h2s: h2s.slice(0, 10),
    pageText: pageText.slice(0, MAX_STORED_TEXT),
  }
}

export async function fetchAndParseMetadataWithHeaders(
  url: string,
  options?: { headers?: Record<string, string> }
): Promise<{ metadata: PageMetadata; responseHeaders: Record<string, string> }> {
  const { html, finalUrl, headers } = await safeFetchHtml(url, { headers: options?.headers })
  return { metadata: parseMetadataFromHtml(html, finalUrl), responseHeaders: headers }
}

export async function fetchAndParseMetadata(
  url: string,
  options?: { headers?: Record<string, string> }
): Promise<PageMetadata> {
  const { metadata } = await fetchAndParseMetadataWithHeaders(url, options)
  return metadata
}
