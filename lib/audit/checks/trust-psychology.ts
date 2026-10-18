import { renderedContentMetadata } from '../browser/rendered-copy'
import { PageMetadata } from '../metadata'
import { CHECK_TEXT_LIMIT } from '../page-text-limits'
import { type PagePurposeResult, isProductPage } from '../page-purpose'
import type { DeterministicFlag } from '../flag-types'
import { hasLogoWall } from './utils'
import { recordObservation, type CheckRecorder } from './assertion'
import { NAVIGATION_OBSERVATION_COPY } from '@/lib/marketing/copy/navigation-observations'

const AUTHORITY_MARKERS = [
  /\b(as seen in|featured in|mentioned in|press|media)\b/i,
  /\b(partnered with|in partnership with)\b/i,
  /\b(certified|certification|soc2|soc\s+2|iso\s+27001|hipaa|gdpr compliant)\b/i,
  /\b(backed by|supported by|funded by|invested by)\b/i,
  /\b(trusted by|loved by|powering|used by)\b/i,
  /\b(in numbers|by the numbers|our customers|our users|our clients|our community)\b/i,
]

const MEDIA_NAMES = [
  /\b(techcrunch|forbes|wired|the\s+verge|product\s+hunt|y\s+combinator|ycombinator)\b/i,
]

const TESTIMONIAL_QUALITY_MARKERS = [
  /\b(CEO|CTO|founder|VP|head of|director|engineer)\s+(at|of|@)\b/i,
  /"[^"]{40,}"/i,
]

const PROOF_REFERENCE = /\b(?:case\s+stud(?:y|ies)|(?:customer|client|user)\s+stor(?:y|ies))\b/i

const PROOF_CONTENT_MARKERS = [
  PROOF_REFERENCE,
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

/** Minimum body text before treating the DOM sample as complete enough for absence claims. */
export const TRUST_DOM_SAMPLE_MIN_CHARS = 200

/**
 * Classify a href as same-site navigation.
 * Relative paths count as internal even when pageHostname is unknown.
 * Absolute URLs require a hostname (from canonical or page URL).
 */
export function isInternalNavigationHref(
  href: string,
  pageHostname: string | null
): boolean {
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

export function resolvePageHostname(
  meta: Pick<PageMetadata, 'canonical'>,
  pageUrl?: string | null
): string | null {
  for (const candidate of [meta.canonical, pageUrl]) {
    if (!candidate) continue
    try {
      return new URL(candidate).hostname
    } catch {
      // try next
    }
  }
  return null
}

export function runTrustPsychologyChecks(
  meta: PageMetadata,
  purpose: PagePurposeResult = { purpose: 'marketing', reasons: [] },
  pageUrl?: string | null,
  record?: CheckRecorder,
): DeterministicFlag[] {
  meta = renderedContentMetadata(meta)
  const findings: DeterministicFlag[] = []
  const productPage = isProductPage(purpose.purpose)
  const bodyText = (meta.pageText ?? '').slice(0, CHECK_TEXT_LIMIT)
  const htmlText = bodyText.toLowerCase()
  const ctaTexts = meta.ctaTexts ?? []
  const links = meta.links ?? []

  const hasAuthorityRef = AUTHORITY_MARKERS.some((p) => p.test(htmlText))
  const hasMediaName = MEDIA_NAMES.some((p) => p.test(htmlText))
  const hasTestimonialLikeContent = PROOF_CONTENT_MARKERS.some((p) => p.test(bodyText))
  // New observations carry scoped quotation facts. The text-only reader remains
  // isolated for historical snapshots that did not record quotation blocks.
  const testimonialBlocks = meta.testimonialBlocks ?? (
    /<blockquote|\b(customer|user|client)\s+(quote|review|feedback)\b|\b(said|says|told us|shared|wrote|commented)\b[^.]{0,30}"/i.test(bodyText)
      ? [{ quote: bodyText, attribution: null }] : []
  )
  const hasTestimonialContent = testimonialBlocks.length > 0
  const hasSpecificTestimonial = hasTestimonialContent && testimonialBlocks.every(block => meta.testimonialBlocks
    ? block.quote.length >= 40 || TESTIMONIAL_QUALITY_MARKERS[0].test(block.attribution ?? '')
    : TESTIMONIAL_QUALITY_MARKERS.some(pattern => pattern.test(block.quote)))
  const hasProofReference = hasTestimonialLikeContent || hasTestimonialContent || links.some(link => PROOF_REFERENCE.test(link.text))
  const hasDataClaim = DATA_SPECIFICITY.some((p) => p.test(bodyText))
  const hasCustomerLogos = hasLogoWall(meta.images ?? [])
  if (productPage && ctaTexts.length > 0) recordObservation(record, 'authority-signals', 'Captured authority signals',
    'Sampled product content includes a recognized authority, testimonial, media, or logo signal',
    `Authority ${hasAuthorityRef}, media ${hasMediaName}, proof reference ${hasProofReference}, customer-logo pattern ${hasCustomerLogos}. Authenticity was not established.`,
    bodyText.length >= 100 || hasAuthorityRef || hasMediaName || hasProofReference || hasCustomerLogos
      ? hasAuthorityRef || hasMediaName || hasProofReference || hasCustomerLogos : undefined, true)
  if (hasTestimonialContent && ctaTexts.length > 0) recordObservation(record, 'testimonial-detail', 'Captured testimonial detail',
    'Sampled testimonial content contains a recognized attribution or substantial-quote pattern',
    `Attribution or substantial-quote pattern ${hasSpecificTestimonial ? 'detected' : 'not detected'}. Customer identity and permission were not verified.`, hasSpecificTestimonial, true)

  // Only flag a total absence of trust signals. If the page shows testimonials or
  // a customer/partner logo wall, it has authority proof (just not press badges),
  // so flagging "no authority signals" there is a false positive.
  // "No authority signals" only matters on a product/marketing page. OSS
  // pages have authority via stars/maintainers (not captured here); docs and
  // placeholder pages do not need press badges. Suppress when the page text is
  // too sparse to evaluate (SPAs, redirects, JS-rendered shells), the check
  // would otherwise fire on every SPA that renders authority signals client-side.
  if (productPage && bodyText.length >= 100 && !hasAuthorityRef && !hasMediaName && !hasProofReference && !hasCustomerLogos && ctaTexts.length > 0) {
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

  if (hasTestimonialContent && !hasSpecificTestimonial && ctaTexts.length > 0) {
    findings.push({
      checkId: 'trust-testimonial-quality',
      rubric: 'MESSAGE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Testimonials lack specificity or named attribution',
      evidence: `${testimonialBlocks.length} quotation blocks sampled. At least one lacks a recognized role attribution or substantial quoted detail in its own recorded scope. Customer identity, permission, and persuasive impact were not verified.`,
      fix: '1. Use testimonials only from real customers or users who gave permission\n2. Prefer real name, title, company, and a specific result or workflow detail\n3. If you cannot use names yet, replace generic praise with a concrete case study, product evidence, or transparent beta feedback summary\n4. Place the strongest substantiated proof closest to the primary CTA',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  // Only flag superlatives in prominent positions (headings, above-fold) or when
  // multiple unsupported claims appear. A single superlative in body copy is
  // common brand voice on legitimate marketing pages and not a trust signal.
  // Leadership terms (leading, trusted, proven) are standard positioning language
  // and are downgraded to POLISH - only aggressive superlatives (best, fastest,
  // #1) escalate to IMPORTANT.
  const headingText = [...(meta.h1s ?? []), ...(meta.h2s ?? [])].join(' ')
  const LEADERSHIP_TERMS = /\b(leading|trusted|industry-standard|battle-tested|proven|enterprise-grade)\b/i
  const AGGRESSIVE_SUPERLATIVES = /\b(the\s+(best|fastest|easiest|most\s+powerful|#1))\b/i

  const claimInHeading = headingText.match(AGGRESSIVE_SUPERLATIVES) ?? headingText.match(/\b(the\s+(best|fastest|easiest|most\s+powerful|#1|leading|top))\b/i)
  const claimInBody = bodyText.match(/\b(the\s+(best|fastest|easiest|most\s+powerful|#1|leading|top))\b/gi)
  const headingClaimCount = (headingText.match(/\b(the\s+(best|fastest|easiest|most\s+powerful|#1|leading|top))\b/gi) || []).length
  const hasAggressiveClaim = !!(headingText.match(AGGRESSIVE_SUPERLATIVES) || (claimInBody && claimInBody.length >= 2))
  const hasLeadershipClaim = LEADERSHIP_TERMS.test(headingText)
  // Fire when: aggressive claim in heading (single is enough), OR 2+ leadership
  // terms in headings, OR 2+ body superlatives without data.
  const hasClaim = hasAggressiveClaim || (hasLeadershipClaim && headingClaimCount >= 2) || (claimInBody && claimInBody.length >= 2)
  recordObservation(record, 'claim-support-signals', 'Captured claim wording',
    'Captured superlative patterns are accompanied by a recognized data-specificity pattern, or no superlative rule is triggered',
    `Superlative pattern ${Boolean(hasClaim)}, specificity pattern ${hasDataClaim}. Claims and supporting data were not independently validated.`,
    bodyText.trim().length >= 100 || headingText.trim().length > 0 ? !hasClaim || hasDataClaim : undefined, true)
  if (hasClaim && !hasDataClaim) {
    const claim = claimInHeading?.[0] ?? claimInBody?.[0] ?? 'superlative claim'
    const isAggressive = AGGRESSIVE_SUPERLATIVES.test(claim)
    findings.push({
      checkId: 'trust-unsupported-claims',
      rubric: 'MESSAGE',
      impactTag: 'TRUST',
      severity: isAggressive ? 'IMPORTANT' : 'POLISH',
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
  if (productPage) recordObservation(record, 'direct-contact-signals', 'Captured contact signals',
    'Captured product content contains an email, phone, support link, or structured contact signal',
    `Contact link ${hasContactLink}, phone ${hasPhone}, email ${emailCount > 0}, structured contact ${meta.hasContactInfo}. Reachability was not tested.`,
    hasContactLink || hasPhone || emailCount > 0 || meta.hasContactInfo ? true : bodyText.length >= TRUST_DOM_SAMPLE_MIN_CHARS ? false : undefined, true)

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

  const pageHostname = resolvePageHostname(meta, pageUrl)
  const internalLinks = links.filter((l) => isInternalNavigationHref(l.href, pageHostname))

  // Do not emit a definitive "0 internal links" claim on sparse SPA shells
  // (empty anchor list + short body text) where navigation may not have hydrated.
  const linkSampleIncomplete =
    links.length === 0 && bodyText.length < TRUST_DOM_SAMPLE_MIN_CHARS
  if (ctaTexts.length > 0) recordObservation(record, 'internal-navigation-count', 'Captured internal navigation',
    'Captured product navigation contains at least two same-site links',
    `${internalLinks.length} same-site links found. Destination responses were not checked by this observation.`,
    linkSampleIncomplete ? undefined : internalLinks.length >= 2, true)

  if (
    !linkSampleIncomplete &&
    internalLinks.length < 2 &&
    ctaTexts.length > 0
  ) {
    findings.push({
      checkId: 'trust-no-internal-links',
      rubric: 'EXPERIENCE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Page has very few internal navigation links',
      evidence: NAVIGATION_OBSERVATION_COPY.navigationEvidence(internalLinks.length, links.length),
      fix: NAVIGATION_OBSERVATION_COPY.navigationGuidance,
      confidence: links.length === 0 ? 0.6 : 0.75,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
