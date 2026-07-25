import { PageMetadata } from '../metadata'
import { CHECK_TEXT_LIMIT } from '../page-text-limits'
import { type PagePurposeResult, isProductPage } from '../page-purpose'
import type { DeterministicFlag } from '../flag-types'
import { hasLogoWall } from './utils'

const AUTHORITY_MARKERS = [
  /\b(as seen in|featured in|mentioned in|press|media)\b/i,
  /\b(partnered with|in partnership with)\b/i,
  /\b(certified|certification|soc2|soc\s+2|iso\s+27001|hipaa|gdpr compliant)\b/i,
  /\b(backed by|supported by|funded by|invested by)\b/i,
]

const MEDIA_NAMES = [
  /\b(techcrunch|forbes|wired|the\s+verge|product\s+hunt|y\s+combinator|ycombinator)\b/i,
]

const TESTIMONIAL_QUALITY_MARKERS = [
  /\b(CEO|CTO|founder|VP|head of|director|engineer)\s+(at|of|@)\b/i,
  /\b"[^"]{40,}"/i,
]

const TESTIMONIAL_PRESENCE_MARKERS = [
  /\b(testimonial|what\s+customers\s+say|customer\s+story|case\s+stud(y|ies)|reviewed\s+by)\b/i,
  /\b(customer|user|client)\s+(quote|review|feedback)\b/i,
  /<blockquote/i,
  /\b(said|says|told\s+us|shared|wrote|commented)\b[^.]{0,30}\b"[^"]{20,}"/i,
]

const DATA_SPECIFICITY = [
  /\d+%\s+(faster|better|lower|higher|reduction|improvement)/i,
  /\d+x\s+(faster|better|more)/i,
  /\d+\s+(minutes?|hours?|days?)\s+(saved|saving|reduced|cut)/i,
  /\b(supports?|handles?|processes?|manages?)\s+\d+/i,
  /\b(benchmark|tested|verified|proven|measured|reviewed)\b/i,
  /\b(feature|capability|function)\s*(s|ies)\b/i,
]

function isInternalNavigationHref(href: string, pageHostname: string | null): boolean {
  const value = href.trim()
  if (!value || value.startsWith('#')) return false

  const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase()
  if (scheme && scheme !== 'http' && scheme !== 'https') return false

  if (value.startsWith('//')) {
    if (!pageHostname) return false
    try {
      return new URL(`https:${value}`).hostname === pageHostname
    } catch {
      return false
    }
  }

  if (!/^https?:\/\//i.test(value)) return true
  if (!pageHostname) return false

  try {
    return new URL(value).hostname === pageHostname
  } catch {
    return false
  }
}

export function runTrustPsychologyChecks(
  meta: PageMetadata,
  purpose: PagePurposeResult = { purpose: 'marketing', reasons: [] }
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const productPage = isProductPage(purpose.purpose)
  const bodyText = (meta.pageText ?? '').slice(0, CHECK_TEXT_LIMIT)
  const htmlText = bodyText.toLowerCase()
  const ctaTexts = meta.ctaTexts ?? []
  const links = meta.links ?? []

  const hasAuthorityRef = AUTHORITY_MARKERS.some((p) => p.test(htmlText))
  const hasMediaName = MEDIA_NAMES.some((p) => p.test(htmlText))
  const hasTestimonialLikeContent = TESTIMONIAL_PRESENCE_MARKERS.some((p) => p.test(bodyText))
  const hasSpecificTestimonial = TESTIMONIAL_QUALITY_MARKERS.some((p) => p.test(bodyText))
  const hasDataClaim = DATA_SPECIFICITY.some((p) => p.test(bodyText))
  const hasCustomerLogos = hasLogoWall(meta.images ?? [])

  // Only flag a total absence of trust signals. If the page shows testimonials or
  // a customer/partner logo wall, it has authority proof (just not press badges),
  // so flagging "no authority signals" there is a false positive.
  // "No authority signals" only matters on a product/marketing page. OSS
  // pages have authority via stars/maintainers (not captured here); docs and
  // placeholder pages do not need press badges. Suppress when the page text is
  // too sparse to evaluate (SPAs, redirects, JS-rendered shells) — the check
  // would otherwise fire on every SPA that renders authority signals client-side.
  if (productPage && bodyText.length >= 100 && !hasAuthorityRef && !hasMediaName && !hasTestimonialLikeContent && !hasCustomerLogos && ctaTexts.length > 0) {
    findings.push({
      checkId: 'trust-no-authority-signals',
      rubric: 'MESSAGE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'No press mentions, partnerships, or authority endorsements found',
      evidence: 'Page has no "as seen in", media logos, partnership badges, certifications, or investor signals visible.',
      fix: '1. Add authority signals only when they are real: press coverage, partnerships, certifications, investor logos, open-source traction, or named customer logos\n2. If you do not have external authority yet, show product proof instead: screenshots, workflow examples, changelog, or transparent founder/company context\n3. Link badges or logos to supporting pages where possible\n4. Position the strongest real signal near the hero or above the CTA',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  if (hasTestimonialLikeContent && !hasSpecificTestimonial && ctaTexts.length > 0) {
    findings.push({
      checkId: 'trust-testimonial-quality',
      rubric: 'MESSAGE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Testimonials lack specificity or named attribution',
      evidence: 'Testimonial-like proof is present, but no testimonials with named roles (e.g. "CTO at Company") or substantive quotes (40+ characters) were found. Generic praise without specifics is less convincing.',
      fix: '1. Use testimonials only from real customers or users who gave permission\n2. Prefer real name, title, company, and a specific result or workflow detail\n3. If you cannot use names yet, replace generic praise with a concrete case study, product evidence, or transparent beta feedback summary\n4. Place the strongest substantiated proof closest to the primary CTA',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  // Only flag superlatives in prominent positions (headings, above-fold) or when
  // multiple unsupported claims appear. A single superlative in body copy is
  // common brand voice on legitimate marketing pages and not a trust signal.
  const headingText = [...(meta.h1s ?? []), ...(meta.h2s ?? [])].join(' ')
  const claimInHeading = headingText.match(/\b(the\s+(best|fastest|easiest|most\s+powerful|#1|leading|top))\b/i)
  const claimInBody = bodyText.match(/\b(the\s+(best|fastest|easiest|most\s+powerful|#1|leading|top))\b/gi)
  const hasClaim = claimInHeading || (claimInBody && claimInBody.length >= 2)
  if (hasClaim && !hasDataClaim) {
    const claim = claimInHeading?.[0] ?? claimInBody?.[0] ?? 'superlative claim'
    findings.push({
      checkId: 'trust-unsupported-claims',
      rubric: 'MESSAGE',
      impactTag: 'TRUST',
      severity: 'IMPORTANT',
      problem: 'Page makes superlative claims without supporting evidence',
      evidence: `Found absolute claims like "${claim}" but no specific data points to back them up. Claims without evidence reduce trust.`,
      fix: '1. Replace each unsupported superlative with a verifiable claim or remove it\n2. Add benchmarks, methodology, customer results, or third-party evidence only when you can substantiate them\n3. Link to case studies, research, or benchmark details when available\n4. Prefer precise scoped claims over absolutes, e.g. "cuts review time for small landing pages" instead of "the fastest"',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
  const emailCount = (bodyText.match(emailRegex) || []).length
  const hasContactLink = links.some((l) => /\b(contact|support|help|get in touch|talk to us|reach out|chat with us|let.s talk)\b/i.test(l.href + ' ' + l.text))
  const hasPhone = /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(bodyText)

  // "No direct contact" is gated to product/marketing pages. Documentation,
  // articles, placeholder, and OSS pages do not need a sales/support contact
  // path, and flagging them here would dominate the top-3 on every docs page.
  // hasContactInfo is derived from the full HTML string (including JSON-LD
  // structured data) and catches contact info that pageText (with scripts
  // stripped) misses. Without this fallback, structured-data emails like
  // "saad@saadbenryane.com" produce false positives on personal/portfolio sites.
  if (productPage && !hasContactLink && !hasPhone && emailCount === 0 && !meta.hasContactInfo) {
    findings.push({
      checkId: 'trust-no-direct-contact',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'IMPORTANT',
      problem: 'No direct contact method (email, phone, or support link) found',
      evidence: 'No email address, phone number, or contact/support page link detected. Visitors who need help before converting have no way to reach you.',
      fix: '1. Add an email address in the footer or header\n2. Add a "Contact" or "Support" link in the main navigation\n3. If a contact page exists, make the link more prominent in the nav or footer\n4. Add a live chat or help widget for immediate assistance',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  const pageHostname = (() => {
    try {
      return meta.canonical ? new URL(meta.canonical).hostname : null
    } catch {
      return null
    }
  })()

  const internalLinks = links.filter((l) => isInternalNavigationHref(l.href, pageHostname))

  if (internalLinks.length < 2 && ctaTexts.length > 0) {
    findings.push({
      checkId: 'trust-no-internal-links',
      rubric: 'EXPERIENCE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Page has very few internal navigation links',
      evidence: `Only ${internalLinks.length} internal link${internalLinks.length === 1 ? '' : 's'} found. Visitors may have no path to explore further.`,
      fix: '1. Add navigation links to key pages (features, pricing, docs, blog)\n2. Ensure the header nav has at least 3-4 internal links\n3. Add contextual CTAs in the body that link to related pages\n4. Include a footer with site map links for discoverability',
      confidence: 0.75,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
